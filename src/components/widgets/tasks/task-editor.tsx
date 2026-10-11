"use client";

import { useState } from "react";
import type { Task } from "@/lib/dashboard-types";
import { PRIORITY_LABELS } from "@/lib/format";
import { Button, Segmented, fieldClass } from "@/components/ui/primitives";
import { IconBell, IconTrash } from "@/components/ui/icons";
import { ReminderForm, TaskReminders } from "./reminder-form";
import type { useTasks } from "./use-tasks";

type Ops = ReturnType<typeof useTasks>;

/** Inline editor: notes, due date and time, priority, list, reminders, delete. */
export function TaskEditor({ task, ops }: { task: Task; ops: Ops }) {
  const [notes, setNotes] = useState(task.notes ?? "");
  const [list, setList] = useState(task.list ?? "");
  const [reminding, setReminding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex flex-col gap-3 pb-3 pr-1 pt-1 sm:pl-[34px]" onClick={(e) => e.stopPropagation()}>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== (task.notes ?? "") && ops.update(task, { notes: notes || null })}
        placeholder="Notes"
        rows={Math.min(6, Math.max(2, notes.split("\n").length))}
        className="w-full resize-none rounded-[12px] bg-gray-100 px-3 py-2 text-[14px] leading-relaxed outline-none placeholder:text-ink-3 focus:bg-white focus:shadow-ring"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          aria-label="Due date"
          value={task.due_date ?? ""}
          onChange={(e) => ops.update(task, { due_date: e.target.value || null })}
          className={`${fieldClass} h-9 w-[150px] max-sm:flex-1`}
        />
        <input
          type="time"
          aria-label="Due time"
          value={task.due_time?.slice(0, 5) ?? ""}
          onChange={(e) => ops.update(task, { due_time: e.target.value || null })}
          className={`${fieldClass} h-9 w-[112px]`}
        />
        <input
          value={list}
          onChange={(e) => setList(e.target.value)}
          onBlur={() => list !== (task.list ?? "") && ops.update(task, { list: list || null })}
          placeholder="List"
          aria-label="List"
          className={`${fieldClass} h-9 w-[130px] max-sm:w-full`}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented<string>
          size="sm"
          value={String(task.priority)}
          onChange={(v) => ops.update(task, { priority: Number(v) })}
          options={PRIORITY_LABELS.map((l, i) => ({ value: String(i), label: l }))}
        />
        <div className="flex items-center gap-1">
          {!reminding && (
            <Button size="sm" variant="ghost" onClick={() => setReminding(true)}>
              <IconBell size={15} /> Remind me
            </Button>
          )}
          {confirmDelete ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
              <Button size="sm" variant="danger" onClick={() => ops.remove(task)}>
                Delete
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Delete task">
              <IconTrash size={15} />
            </Button>
          )}
        </div>
      </div>
      <TaskReminders taskId={task.id} />
      {reminding && <ReminderForm task={task} onDone={() => setReminding(false)} />}
    </div>
  );
}

/** Title that edits in place (Notion style): looks like text until focused. */
export function InlineTitle({
  task,
  ops,
  done,
  className = "",
}: {
  task: Task;
  ops: Ops;
  done?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState(task.title);
  const [prev, setPrev] = useState(task.title);
  if (task.title !== prev) {
    setPrev(task.title);
    setValue(task.title);
  }
  const commit = () => {
    const v = value.trim();
    if (!v) setValue(task.title);
    else if (v !== task.title) void ops.update(task, { title: v });
  };
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setValue(task.title);
          (e.target as HTMLInputElement).blur();
        }
      }}
      aria-label="Task title"
      className={`min-w-0 flex-1 truncate rounded-[6px] bg-transparent px-1 py-0.5 -mx-1 text-[15px] font-medium outline-none transition focus:bg-gray-100 ${
        done ? "text-ink-3 line-through decoration-gray-400" : ""
      } ${className}`}
    />
  );
}
