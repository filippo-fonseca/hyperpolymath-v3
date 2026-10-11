"use client";

import { useState } from "react";
import type { Task } from "@/lib/dashboard-types";
import { dueLabel, timeLabel } from "@/lib/format";
import { IconArrowUp, IconRepeat } from "@/components/ui/icons";
import { stop } from "@/components/ui/primitives";

export function isOverdue(t: Task, today: string) {
  return !!t.due_date && t.due_date < today && t.status !== "done";
}

/** Small trailing meta: due label (red when overdue), time, recurrence. */
export function DueMeta({ task, today, showToday = false }: { task: Task; today: string; showToday?: boolean }) {
  const label = dueLabel(task.due_date, today);
  const overdue = isOverdue(task, today);
  const time = timeLabel(task.due_time?.slice(0, 5) ?? null);
  const parts = [label === "Today" && !showToday ? null : label, time].filter(Boolean).join(" · ");
  return (
    <span className={`flex shrink-0 items-center gap-1 text-[12.5px] tabular-nums ${overdue ? "text-danger" : "text-gray-500"}`}>
      {task.recurrence ? <IconRepeat size={12} className="opacity-70" /> : null}
      {parts}
    </span>
  );
}

export function PriorityDot({ p }: { p: number }) {
  if (!p) return null;
  const c = p >= 3 ? "bg-danger" : p === 2 ? "bg-[#ff8a1f]" : "bg-gray-400";
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${c}`} aria-label={`Priority ${p}`} />;
}

/** Pill input with a send arrow that turns accent when there's text. */
export function QuickAdd({
  placeholder,
  onSubmit,
  className = "",
  autoFocus = false,
}: {
  placeholder: string;
  onSubmit: (text: string) => Promise<unknown>;
  className?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const has = value.trim().length > 0;
  const submit = async () => {
    if (!has || busy) return;
    setBusy(true);
    const ok = await onSubmit(value.trim());
    setBusy(false);
    if (ok !== null) setValue("");
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onClick={stop}
      onPointerDown={stop}
      className={`flex h-11 items-center gap-2 rounded-full bg-gray-100 pl-4 pr-1.5 transition focus-within:bg-white focus-within:shadow-ring ${className}`}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        maxLength={500}
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
      />
      <button
        type="submit"
        aria-label="Add"
        disabled={!has || busy}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200 ${
          has ? "bg-accent text-white" : "bg-gray-200 text-gray-500"
        }`}
      >
        <IconArrowUp size={16} strokeWidth={2.2} />
      </button>
    </form>
  );
}
