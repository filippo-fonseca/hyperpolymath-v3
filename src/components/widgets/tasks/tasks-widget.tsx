"use client";

import { AnimatePresence, motion } from "motion/react";
import type { Task } from "@/lib/dashboard-types";
import type { WidgetSize } from "@/lib/widgets";
import { Checkbox, Eyebrow, useFitCount } from "@/components/ui/primitives";
import { DueMeta, isOverdue, QuickAdd } from "./task-bits";
import { sortToday, useTasks } from "./use-tasks";

const ROW_H = 32;

/** "Today": due today and overdue, Things-style rows. */
export function TasksWidget({ size }: { size: WidgetSize }) {
  const { open, today, isDone, toggle, create } = useTasks();
  const [listRef, fit] = useFitCount<HTMLDivElement>(ROW_H, size === "l" ? 5 : 3);
  const due = sortToday(open.filter((t) => t.due_date && t.due_date <= today));
  const overdue = due.filter((t) => isOverdue(t, today)).length;
  const remaining = due.filter((t) => !isDone(t)).length;

  if (size === "s") {
    const next = due.find((t) => !isDone(t));
    return (
      <div className="flex h-full flex-col">
        <Eyebrow>Today</Eyebrow>
        <div className="mt-1 text-[34px] font-light leading-none tracking-[-0.02em] tabular-nums">{remaining}</div>
        <div className="mt-auto">
          {next ? (
            <>
              <div className="line-clamp-2 text-[14px] font-medium leading-snug">{next.title}</div>
              {isOverdue(next, today) && <div className="mt-0.5 text-[12px] text-danger">Overdue</div>}
            </>
          ) : (
            <div className="text-[14px] text-ink-3">All clear</div>
          )}
        </div>
      </div>
    );
  }

  // Reserve a line for "N more" when the list doesn't fit.
  const rows = due.length > fit ? Math.max(1, fit - 1) : fit;
  const shown = due.slice(0, rows);
  const more = due.length - shown.length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between">
        <Eyebrow>Today</Eyebrow>
        <span className="text-[12px] font-medium tabular-nums text-gray-500">
          {overdue > 0 ? <span className="text-danger">{overdue} overdue · </span> : null}
          {remaining} left
        </span>
      </div>
      {size === "l" && (
        <QuickAdd
          className="mt-3"
          placeholder="Add a task for today"
          onSubmit={(title) => create({ title, due_date: today })}
        />
      )}
      <div ref={listRef} className={`min-h-0 flex-1 overflow-hidden ${size === "l" ? "mt-2" : "mt-1"}`}>
        {due.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="text-[15px] font-medium">Nothing due today</div>
            <div className="mt-0.5 text-[13px] text-ink-3">Enjoy the quiet.</div>
          </div>
        ) : (
          <ul className="flex flex-col">
            <AnimatePresence initial={false}>
              {shown.map((t) => (
                <TodayRow key={t.id} task={t} today={today} done={isDone(t)} onToggle={() => toggle(t)} />
              ))}
            </AnimatePresence>
            {more > 0 && <li className="flex h-8 items-center text-[13px] text-gray-500">{more} more</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

function TodayRow({ task, today, done, onToggle }: { task: Task; today: string; done: boolean; onToggle: () => void }) {
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      className="flex h-8 items-center gap-3"
    >
      <Checkbox checked={done} onToggle={onToggle} label={`Complete ${task.title}`} size={18} />
      <span
        className={`min-w-0 flex-1 truncate text-[15px] font-medium transition-colors duration-300 ${
          done ? "text-ink-3 line-through decoration-gray-400" : ""
        }`}
      >
        {task.title}
      </span>
      {!done && <DueMeta task={task} today={today} />}
    </motion.li>
  );
}
