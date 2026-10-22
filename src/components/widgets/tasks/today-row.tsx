"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Task } from "@/lib/dashboard-types";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Sheet, stop } from "@/components/ui/primitives";
import { IconBell, IconCalendar, IconDots, IconFolder, IconPencil, IconRepeat, IconTrash } from "@/components/ui/icons";
import { useDashboard } from "@/components/dashboard/context";
import { Emoji, Layer, ProjectPicker } from "../projects/project-bits";
import { useProjects } from "../projects/use-projects";
import { DueChip, PriorityCheck } from "./task-bits";
import { ScheduleMenu, dateWords, priorityItems } from "./task-menus";
import { InlineTitle, TaskEditor } from "./task-editor";
import type { useTasks } from "./use-tasks";

type Ops = ReturnType<typeof useTasks>;

/** full: the Today page. card: two lines in a large card. dense: one line in a small card. */
export type RowVariant = "full" | "card" | "dense";

export const ROW_HEIGHTS = { dense: 40, card: 52 } as const;

/** How long the filled circle shows before the row leaves. */
const SETTLE_MS = 280;

const EASE = [0.22, 1, 0.36, 1] as const;

function firstLine(notes: string | null) {
  return notes?.split("\n").map((l) => l.replace(/^[#>*\-\s]+/, "").trim()).find(Boolean) ?? "";
}

/** Whether a row has anything for its meta line (cards size rows by this). */
export function useRowMeta() {
  const { data } = useDashboard();
  const { index } = useProjects();
  return (task: Task, opts: { hideToday?: boolean; hideDate?: boolean } = {}) => {
    const project = task.project_id ? index.get(task.project_id)?.project ?? null : null;
    const reminder = data.reminders.some((r) => r.task_id === task.id && r.active);
    const showDue =
      !opts.hideDate && !!task.due_date && !(opts.hideToday && task.due_date === data.today && !task.due_time);
    return { project, reminder, showDue, any: showDue || reminder || !!task.recurrence || !!project };
  };
}

/**
 * A task row, Todoist style: priority circle, title, a notes snippet, then a
 * meta line with the due chip, repeat and reminder marks and the project on
 * the right. Hover (always on touch) shows edit, schedule and more.
 */
export function TodayRow({
  task,
  ops,
  variant = "full",
  hideToday = false,
  hideDate = false,
  expanded = false,
  onOpen,
}: {
  task: Task;
  ops: Ops;
  variant?: RowVariant;
  /** In the Today section: no "Today" chip unless there's a time. */
  hideToday?: boolean;
  /** In a day group: the heading already says the date. */
  hideDate?: boolean;
  expanded?: boolean;
  onOpen: () => void;
}) {
  const done = ops.isDone(task);
  const [completing, setCompleting] = useState(false);
  const meta = useRowMeta()(task, { hideToday, hideDate });
  const checked = done || completing;

  const onCheck = () => {
    if (done) return void ops.toggle(task);
    if (completing) return;
    // Fill the circle first, then let the row fade and fold away.
    setCompleting(true);
    window.setTimeout(() => {
      void ops.complete(task);
      setCompleting(false);
    }, SETTLE_MS);
  };

  const check = (
    <PriorityCheck
      checked={checked}
      priority={task.priority}
      onToggle={onCheck}
      label={done ? `Mark ${task.title} not done` : `Complete ${task.title}`}
      className="-ml-2.5"
    />
  );
  const title = (
    <span
      className={`min-w-0 transition-colors duration-200 ${checked ? "text-ink-3" : ""} ${done ? "line-through decoration-gray-400" : ""}`}
    >
      {task.title}
    </span>
  );
  const metaLine = meta.any && (
    <div className="flex min-w-0 items-center gap-2.5 text-[12px] leading-[18px] text-gray-500">
      {meta.showDue && <DueChip task={task} today={ops.today} hideToday={hideToday} />}
      {task.recurrence ? <IconRepeat size={13} aria-label="Repeats" className="shrink-0" /> : null}
      {meta.reminder && <IconBell size={13} aria-label="Has a reminder" className="shrink-0" />}
      {meta.project && (
        <span className="ml-auto flex min-w-0 items-center gap-1 pl-1">
          <span className="truncate">{meta.project.name}</span>
          <Emoji emoji={meta.project.emoji} size={11} />
        </span>
      )}
    </div>
  );

  const motionProps = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: "auto" },
    exit: { opacity: 0, height: 0, transition: { duration: 0.22, ease: EASE } },
    transition: { duration: 0.22, ease: EASE },
  };

  if (variant === "dense") {
    return (
      <motion.li {...motionProps} className="group/row relative overflow-hidden">
        <div className="flex h-10 cursor-pointer items-center" onClick={stopThen(onOpen)} onPointerDown={stop}>
          {check}
          <span className="flex min-w-0 flex-1 items-center text-[14.5px]">
            <span className="truncate">{title}</span>
          </span>
          {meta.showDue && (
            <span className="ml-2 shrink-0 text-[12px]">
              <DueChip task={task} today={ops.today} hideToday={hideToday} />
            </span>
          )}
          {!done && <RowActions task={task} ops={ops} onEdit={onOpen} compact />}
        </div>
      </motion.li>
    );
  }

  if (variant === "card") {
    return (
      <motion.li {...motionProps} className="group/row relative overflow-hidden">
        <div
          className={`flex cursor-pointer items-start ${meta.any ? "h-[52px]" : "h-10"}`}
          onClick={stopThen(onOpen)}
          onPointerDown={stop}
        >
          {check}
          <div className="min-w-0 flex-1 pt-[9px]">
            <div className="truncate text-[14.5px] leading-[22px]">{title}</div>
            {metaLine}
          </div>
          {!done && <RowActions task={task} ops={ops} onEdit={onOpen} compact />}
        </div>
      </motion.li>
    );
  }

  const notes = firstLine(task.notes);
  return (
    <motion.li {...motionProps} className="group/row relative overflow-hidden border-b border-gray-150">
      <div className="flex cursor-pointer items-start py-1" onClick={onOpen}>
        {check}
        <div className="min-w-0 flex-1 py-[9px]">
          <div className="line-clamp-2 text-[15px] leading-[22px]">{title}</div>
          {notes && <p className="truncate text-[13px] leading-[19px] text-ink-3">{notes}</p>}
          {metaLine && <div className="mt-1">{metaLine}</div>}
        </div>
        {!done && <RowActions task={task} ops={ops} onEdit={onOpen} />}
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="overflow-hidden"
          >
            <TaskEditor task={task} ops={ops} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/** Card rows live inside a clickable card: handle the tap here, not there. */
function stopThen(fn: () => void) {
  return (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
}

const ACTION =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-150 hover:text-ink [@media(hover:hover)]:h-8 [@media(hover:hover)]:w-8";

/**
 * Edit, schedule and more. On a mouse they float over the row's right edge
 * on hover; on touch they sit in the row (minus edit, since a tap on the row
 * already opens the editor). Card rows keep them for the mouse only.
 */
function RowActions({ task, ops, onEdit, compact = false }: { task: Task; ops: Ops; onEdit: () => void; compact?: boolean }) {
  const [picking, setPicking] = useState(false);
  const more: MenuItem[] = [
    { heading: "Priority" },
    ...priorityItems(task.priority, (priority) => void ops.update(task, { priority })),
    { divider: true },
    { label: "Move to project", icon: <IconFolder size={15} />, onSelect: () => setPicking(true) },
    { divider: true },
    { label: "Delete", icon: <IconTrash size={15} />, danger: true, onSelect: () => void ops.remove(task) },
  ];
  return (
    <div
      onClick={stop}
      onPointerDown={stop}
      className={`flex shrink-0 items-center gap-0.5 [@media(hover:hover)]:absolute [@media(hover:hover)]:right-0 [@media(hover:hover)]:top-1 [@media(hover:hover)]:pl-4 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-hover/row:opacity-100 [@media(hover:hover)]:focus-within:opacity-100 ${
        compact
          ? "[@media(hover:none)]:hidden [@media(hover:hover)]:bg-[linear-gradient(to_right,transparent,var(--surface)_14px)]"
          : "[@media(hover:hover)]:bg-[linear-gradient(to_right,transparent,var(--bg)_14px)]"
      }`}
    >
      <button type="button" aria-label="Edit task" title="Edit task" onClick={onEdit} className={`${ACTION} [@media(hover:none)]:hidden`}>
        <IconPencil size={16} />
      </button>
      <ScheduleMenu
        today={ops.today}
        value={task.due_date}
        time={task.due_time?.slice(0, 5) ?? null}
        onPick={(date, time) => {
          if (time !== undefined) void ops.update(task, { due_date: date, due_time: time });
          else void ops.reschedule([task], date, dateWords(date, ops.today));
        }}
        className={ACTION}
      >
        <IconCalendar size={16} />
      </ScheduleMenu>
      <Menu label="More actions" items={more} className={ACTION}>
        <IconDots size={17} />
      </Menu>
      <ProjectPicker open={picking} onClose={() => setPicking(false)} value={task.project_id} onChange={(project) => void ops.update(task, { project })} />
    </div>
  );
}

/** The editor in a sheet, for rows on dashboard cards with no room to expand. */
export function TaskSheet({ task, ops, onClose }: { task: Task | null; ops: Ops; onClose: () => void }) {
  return (
    <Layer>
      <Sheet open={!!task} onClose={onClose} title="Task" width={520}>
        {task && (
          <div className="pb-2">
            <div className="flex items-start">
              <PriorityCheck
                checked={ops.isDone(task)}
                priority={task.priority}
                onToggle={() => {
                  onClose();
                  if (ops.isDone(task)) void ops.toggle(task);
                  else void ops.complete(task);
                }}
                label={`Complete ${task.title}`}
                className="-ml-2.5 -mt-0.5"
              />
              <div className="flex min-w-0 flex-1 pt-1.5">
                <InlineTitle task={task} ops={ops} className="text-[16px]" />
              </div>
            </div>
            <TaskEditor key={task.id} task={task} ops={ops} />
          </div>
        )}
      </Sheet>
    </Layer>
  );
}
