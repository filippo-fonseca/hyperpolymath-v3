"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Task, TaskStatus } from "@/lib/dashboard-types";
import { PRIORITY_LABELS, longDate, weekdayName } from "@/lib/format";
import { Checkbox, IconButton, Segmented } from "@/components/ui/primitives";
import { IconBoard, IconChevronDown, IconList, IconTable, IconTrash } from "@/components/ui/icons";
import { ExpandedHeader } from "@/components/dashboard/expanded";
import { DueMeta, PriorityDot, QuickAdd } from "./task-bits";
import { InlineTitle, TaskEditor } from "./task-editor";
import { sortToday, useTasks } from "./use-tasks";

type View = "list" | "board" | "table";
type Ops = ReturnType<typeof useTasks>;

export function TasksView() {
  const ops = useTasks();
  const [view, setView] = useState<View>("list");
  const [dueToday, setDueToday] = useState(true);

  return (
    <div>
      <ExpandedHeader
        eyebrow={
          <>
            <span className="text-accent">{weekdayName(ops.today)}</span>, {longDate(ops.today)}
          </>
        }
        title="Tasks"
      />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <QuickAdd
          className="flex-1"
          placeholder={dueToday ? "New task for today" : "New task"}
          onSubmit={(title) => ops.create({ title, due_date: dueToday ? ops.today : null })}
        />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setDueToday((v) => !v)}
            aria-pressed={dueToday}
            className={`h-8 rounded-full px-3 text-[13px] font-medium transition ${
              dueToday ? "bg-accent-soft text-accent-hover" : "bg-gray-150 text-ink-2"
            }`}
          >
            Today
          </button>
          <Segmented<View>
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: <><IconList size={15} /> <span className="max-sm:sr-only">List</span></> },
              { value: "board", label: <><IconBoard size={15} /> <span className="max-sm:sr-only">Board</span></> },
              { value: "table", label: <><IconTable size={15} /> <span className="max-sm:sr-only">Table</span></> },
            ]}
          />
        </div>
      </div>
      {view === "list" && <ListView ops={ops} />}
      {view === "board" && <BoardView ops={ops} />}
      {view === "table" && <TableView ops={ops} />}
    </div>
  );
}

/* ---------------- List ---------------- */

function ListView({ ops }: { ops: Ops }) {
  const { open, done, today } = ops;
  const groups: { title: string; tasks: Task[]; tone?: "danger" }[] = [
    { title: "Overdue", tasks: sortToday(open.filter((t) => t.due_date && t.due_date < today)), tone: "danger" },
    { title: "Today", tasks: sortToday(open.filter((t) => t.due_date === today)) },
    { title: "Upcoming", tasks: sortToday(open.filter((t) => t.due_date && t.due_date > today)) },
    { title: "No date", tasks: open.filter((t) => !t.due_date).sort((a, b) => b.priority - a.priority) },
    { title: "Done", tasks: done },
  ];
  const [openId, setOpenId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const empty = open.length === 0;

  return (
    <div className="flex flex-col gap-7">
      {empty && <div className="py-10 text-center text-[15px] text-ink-3">No open tasks. Add one above.</div>}
      {groups.map((g) => {
        if (!g.tasks.length) return null;
        const isDone = g.title === "Done";
        return (
          <section key={g.title}>
            <button
              type="button"
              disabled={!isDone}
              onClick={() => setShowDone((v) => !v)}
              className="mb-1 flex items-center gap-2 text-[13px] font-semibold"
            >
              <span className={g.tone === "danger" ? "text-danger" : "text-gray-500"}>{g.title}</span>
              <span className="font-medium tabular-nums text-ink-3">{g.tasks.length}</span>
              {isDone && (
                <IconChevronDown size={14} className={`text-ink-3 transition-transform ${showDone ? "rotate-180" : ""}`} />
              )}
            </button>
            {(!isDone || showDone) && (
              <ul className="divide-y divide-gray-150">
                <AnimatePresence initial={false}>
                  {g.tasks.map((t) => (
                    <ListRow
                      key={t.id}
                      task={t}
                      ops={ops}
                      expanded={openId === t.id}
                      onToggleOpen={() => setOpenId((id) => (id === t.id ? null : t.id))}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ListRow({ task, ops, expanded, onToggleOpen }: { task: Task; ops: Ops; expanded: boolean; onToggleOpen: () => void }) {
  const done = ops.isDone(task);
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
      className="group"
    >
      <div className="flex min-h-11 cursor-default items-center gap-3 py-1.5" onClick={onToggleOpen}>
        <Checkbox checked={done} onToggle={() => ops.toggle(task)} label={`Complete ${task.title}`} />
        <InlineTitle task={task} ops={ops} done={done} />
        <PriorityDot p={task.priority} />
        {task.list && <span className="hidden shrink-0 text-[12.5px] text-gray-500 sm:inline">{task.list}</span>}
        <DueMeta task={task} today={ops.today} />
        <IconButton
          label={expanded ? "Collapse" : "Details"}
          className="h-7 w-7 text-ink-3 opacity-60 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onToggleOpen();
          }}
        >
          <IconChevronDown size={15} className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
        </IconButton>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <TaskEditor task={task} ops={ops} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/* ---------------- Board ---------------- */

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: "todo", title: "To do" },
  { status: "doing", title: "Doing" },
  { status: "done", title: "Done" },
];

function BoardView({ ops }: { ops: Ops }) {
  const all = [...ops.open, ...ops.done];
  const [dragId, setDragId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const t = all.find((x) => x.id === e.active.id);
    const status = e.over?.id as TaskStatus | undefined;
    if (t && status && status !== t.status) {
      if (status === "done" && t.status !== "done") void ops.toggle(t);
      else void ops.setStatus(t, status);
    }
  };
  const dragging = all.find((t) => t.id === dragId);

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((c) => {
          const tasks = sortToday(all.filter((t) => t.status === c.status));
          return (
            <Column key={c.status} id={c.status} title={c.title} count={tasks.length}>
              {tasks.map((t) => (
                <BoardCard
                  key={t.id}
                  task={t}
                  ops={ops}
                  expanded={openId === t.id}
                  onToggleOpen={() => setOpenId((id) => (id === t.id ? null : t.id))}
                />
              ))}
            </Column>
          );
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
        {dragging && (
          <div className="rotate-[1.5deg] rounded-[14px] bg-white p-3 text-[14px] font-medium shadow-lift">{dragging.title}</div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ id, title, count, children }: { id: TaskStatus; title: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[120px] flex-col gap-2 rounded-[18px] p-2.5 transition-colors duration-200 ${
        isOver ? "bg-accent-soft" : "bg-gray-100"
      }`}
    >
      <div className="flex items-center gap-2 px-1.5 pb-1 pt-0.5 text-[13px] font-semibold text-gray-600">
        {title}
        <span className="font-medium text-ink-3">{count}</span>
      </div>
      {children}
    </div>
  );
}

function BoardCard({ task, ops, expanded, onToggleOpen }: { task: Task; ops: Ops; expanded: boolean; onToggleOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onToggleOpen}
      className={`touch-manipulation rounded-[14px] bg-white p-3 shadow-ring transition-opacity ${isDragging ? "opacity-40" : ""}`}
    >
      <div className={`text-[14px] font-medium leading-snug ${task.status === "done" ? "text-ink-3 line-through" : ""}`}>
        {task.title}
      </div>
      {(task.due_date || task.priority > 0 || task.list) && (
        <div className="mt-1.5 flex items-center gap-2">
          <PriorityDot p={task.priority} />
          {task.list && <span className="text-[12px] text-gray-500">{task.list}</span>}
          <span className="ml-auto">
            <DueMeta task={task} today={ops.today} showToday />
          </span>
        </div>
      )}
      {expanded && (
        <div className="mt-2 sm:-ml-[34px]" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <TaskEditor task={task} ops={ops} />
        </div>
      )}
    </div>
  );
}

/* ---------------- Table ---------------- */

function TableView({ ops }: { ops: Ops }) {
  const rows = [...sortToday(ops.open), ...ops.done];
  const cell = "h-9 rounded-[8px] bg-transparent px-2 text-[14px] outline-none transition hover:bg-gray-100 focus:bg-gray-100";
  return (
    <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left">
        <thead>
          <tr className="text-[12px] font-semibold text-gray-500">
            <th className="w-8 pb-2" />
            <th className="pb-2 pl-2 font-semibold">Title</th>
            <th className="w-[150px] pb-2 pl-2 font-semibold">Due</th>
            <th className="w-[110px] pb-2 pl-2 font-semibold">Priority</th>
            <th className="w-[120px] pb-2 pl-2 font-semibold">List</th>
            <th className="w-[100px] pb-2 pl-2 font-semibold">Status</th>
            <th className="w-9 pb-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="group [&>td]:border-t [&>td]:border-gray-150">
              <td className="py-1">
                <Checkbox checked={ops.isDone(t)} onToggle={() => ops.toggle(t)} label={`Complete ${t.title}`} size={18} />
              </td>
              <td className="py-1 pl-1">
                <div className="flex px-1">
                  <InlineTitle task={t} ops={ops} done={ops.isDone(t)} className="text-[14px] font-normal" />
                </div>
              </td>
              <td className="py-1">
                <input
                  type="date"
                  aria-label="Due date"
                  value={t.due_date ?? ""}
                  onChange={(e) => ops.update(t, { due_date: e.target.value || null })}
                  className={`${cell} w-full ${t.due_date && t.due_date < ops.today && t.status !== "done" ? "text-danger" : ""}`}
                />
              </td>
              <td className="py-1">
                <select
                  aria-label="Priority"
                  value={t.priority}
                  onChange={(e) => ops.update(t, { priority: Number(e.target.value) })}
                  className={`${cell} w-full appearance-none`}
                >
                  {PRIORITY_LABELS.map((l, i) => (
                    <option key={i} value={i}>
                      {l}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-1">
                <ListCell task={t} ops={ops} className={`${cell} w-full`} />
              </td>
              <td className="py-1">
                <select
                  aria-label="Status"
                  value={t.status}
                  onChange={(e) => ops.setStatus(t, e.target.value as TaskStatus)}
                  className={`${cell} w-full appearance-none`}
                >
                  <option value="todo">To do</option>
                  <option value="doing">Doing</option>
                  <option value="done">Done</option>
                </select>
              </td>
              <td className="py-1 text-right">
                <IconButton label="Delete task" className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 max-sm:opacity-60" onClick={() => ops.remove(t)}>
                  <IconTrash size={15} />
                </IconButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="py-10 text-center text-[15px] text-ink-3">No tasks yet.</div>}
    </div>
  );
}

function ListCell({ task, ops, className }: { task: Task; ops: Ops; className: string }) {
  const [v, setV] = useState(task.list ?? "");
  const [prev, setPrev] = useState(task.list);
  if (prev !== task.list) {
    setPrev(task.list);
    setV(task.list ?? "");
  }
  return (
    <input
      value={v}
      placeholder="None"
      aria-label="List"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== (task.list ?? "") && ops.update(task, { list: v || null })}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={`${className} placeholder:text-ink-3`}
    />
  );
}
