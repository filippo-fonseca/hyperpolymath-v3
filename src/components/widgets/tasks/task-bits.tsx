"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { Task } from "@/lib/dashboard-types";
import { dueLabel, timeLabel } from "@/lib/format";
import { dueTone, type DueTone } from "@/lib/today";
import { IconArrowUp, IconCalendar, IconCheck, IconRepeat } from "@/components/ui/icons";
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

/* ---------- Todoist-style pieces ---------- */

// Resolved colors (not CSS vars) so the fill can animate. P1 red, P2 orange,
// P3 blue, P4 plain gray. Keyed by the stored priority, 3 being P1.
export const PRIORITY_COLORS: Record<number, { ring: string; tint: string; fill: string }> = {
  3: { ring: "#ff263c", tint: "rgba(255, 38, 60, 0.1)", fill: "#ff263c" },
  2: { ring: "#ff8a1f", tint: "rgba(255, 138, 31, 0.12)", fill: "#ff8a1f" },
  1: { ring: "#1084fe", tint: "rgba(16, 132, 254, 0.1)", fill: "#1084fe" },
  0: { ring: "#b7b7b7", tint: "rgba(255, 255, 255, 0)", fill: "#959595" },
};

export const priorityColors = (p: number) => PRIORITY_COLORS[Math.max(0, Math.min(3, Math.round(p)))];

/**
 * Round checkbox whose ring and tint say the priority. Hovering shows a faint
 * check; checking fills it with a little pop. The hit area is 40px around a
 * 20px circle, so place it with negative margins.
 */
export function PriorityCheck({
  checked,
  priority,
  onToggle,
  label,
  className = "",
}: {
  checked: boolean;
  priority: number;
  onToggle: () => void;
  label: string;
  className?: string;
}) {
  const c = priorityColors(priority);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onPointerDown={stop}
      className={`group/check inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${className}`}
    >
      <motion.span
        initial={false}
        animate={{ backgroundColor: checked ? c.fill : c.tint, scale: checked ? [1, 1.18, 1] : 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="flex h-5 w-5 items-center justify-center rounded-full"
        style={{ boxShadow: checked ? "none" : `inset 0 0 0 ${priority > 0 ? 2 : 1.5}px ${c.ring}` }}
      >
        <IconCheck
          size={13}
          strokeWidth={2.8}
          className={`transition-opacity duration-150 ${checked ? "opacity-100" : "opacity-0 group-hover/check:opacity-60"}`}
          style={{ color: checked ? "#fff" : c.ring }}
        />
      </motion.span>
    </button>
  );
}

const TONE_CLASS: Record<DueTone, string> = {
  overdue: "text-danger",
  today: "text-[#1f8a52]",
  tomorrow: "text-[#d9730d]",
  later: "text-[#7a5af8]",
};

/**
 * Due date chip, colored by how close it is: overdue red, today green,
 * tomorrow orange, later purple. Inside the Today section "Today" goes
 * without saying, so only a time shows there.
 */
export function DueChip({ task, today, hideToday = false }: { task: Task; today: string; hideToday?: boolean }) {
  if (!task.due_date) return null;
  const tone = dueTone(task.due_date, today);
  const time = timeLabel(task.due_time?.slice(0, 5) ?? null);
  if (tone === "today" && hideToday && !time) return null;
  const label = tone === "today" && hideToday ? time : [dueLabel(task.due_date, today), time].filter(Boolean).join(" ");
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 tabular-nums ${TONE_CLASS[tone]}`}>
      <IconCalendar size={12} strokeWidth={2} />
      {label}
    </span>
  );
}
