"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Task } from "@/lib/dashboard-types";
import type { WidgetSize } from "@/lib/widgets";
import { localDate } from "@/lib/time";
import { shortDate } from "@/lib/format";
import { Checkbox, useFitCount } from "@/components/ui/primitives";
import { IconPlus } from "@/components/ui/icons";
import { KiwiSleeping } from "@/components/illustrations";
import { HeaderAction, WidgetHeader } from "@/components/dashboard/widget-chrome";
import { useDashboard } from "@/components/dashboard/context";
import { Emoji } from "../projects/project-bits";
import { useProjects } from "../projects/use-projects";
import { DueMeta, PriorityDot, isOverdue, QuickAdd } from "./task-bits";
import { sortToday, useTasks } from "./use-tasks";

const ROW_H = 32;

type Section = { key: string; title: string; tone?: "danger"; tasks: Task[] };

/** "Today": due today and overdue, Things-style rows, with what's next when the day is clear. */
export function TasksWidget({ size }: { size: WidgetSize }) {
  const { data } = useDashboard();
  const { open, done, today, isDone, toggle, create } = useTasks();
  const [adding, setAdding] = useState(false);
  const [listRef, fit] = useFitCount<HTMLDivElement>(ROW_H, size === "l" ? 7 : size === "w" ? 6 : 3);

  const due = sortToday(open.filter((t) => t.due_date && t.due_date <= today));
  const overdue = due.filter((t) => isOverdue(t, today));
  const dueToday = due.filter((t) => !isOverdue(t, today));
  const remaining = due.filter((t) => !isDone(t)).length;
  const upcoming = open
    .filter((t) => t.due_date && t.due_date > today && !isDone(t))
    .sort((a, b) => (a.due_date! + (a.due_time ?? "")).localeCompare(b.due_date! + (b.due_time ?? "")));
  const inbox = open.filter((t) => !t.due_date && !isDone(t)).sort((a, b) => b.priority - a.priority);
  // Finished today: what the server already has plus anything just ticked.
  const doneToday =
    done.filter((t) => t.completed_at && localDate(new Date(t.completed_at), data.tz) === today && isDone(t)).length +
    due.filter((t) => t.status !== "done" && isDone(t)).length;
  const dayTotal = remaining + doneToday;

  const meta = (
    <>
      {overdue.length > 0 && <span className="text-danger">{overdue.length} overdue</span>}
      {overdue.length > 0 && <span className="text-gray-300">·</span>}
      <span>{remaining ? `${remaining} left` : due.length || doneToday ? "Done for today" : ""}</span>
    </>
  );
  const addAction = (
    <HeaderAction label="Add a task for today" onClick={() => setAdding((v) => !v)}>
      <IconPlus size={16} strokeWidth={2} />
    </HeaderAction>
  );
  const quickAdd = (autoFocus: boolean) => (
    <QuickAdd placeholder="Add a task for today" autoFocus={autoFocus} onSubmit={(title) => create({ title, due_date: today })} />
  );

  if (size === "s") {
    const next = due.find((t) => !isDone(t));
    return (
      <div className="flex h-full flex-col">
        <WidgetHeader />
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-[34px] font-light leading-none tracking-[-0.02em] tabular-nums">{remaining}</span>
          <span className="text-[13px] text-ink-3">{remaining === 1 ? "task left" : "tasks left"}</span>
        </div>
        <DayBar done={doneToday} total={dayTotal} className="mt-2.5" />
        <div className="mt-auto">
          {next ? (
            <>
              {isOverdue(next, today) && <div className="text-[12px] font-medium text-danger">Overdue</div>}
              <div className="line-clamp-2 text-[14px] font-medium leading-snug">{next.title}</div>
            </>
          ) : upcoming[0] ? (
            <>
              <div className="text-[12px] text-ink-3">Next up · {shortDate(upcoming[0].due_date!)}</div>
              <div className="line-clamp-2 text-[14px] font-medium leading-snug">{upcoming[0].title}</div>
            </>
          ) : (
            <div className="text-[14px] text-ink-3">All clear</div>
          )}
        </div>
      </div>
    );
  }

  if (size === "w") {
    return (
      <div className="flex h-full flex-col">
        <WidgetHeader meta={meta} />
        <div className="mt-2 flex items-center gap-3">
          <div className="min-w-0 flex-1">{quickAdd(adding)}</div>
          {dayTotal > 0 && (
            <div className="hidden w-[200px] shrink-0 sm:block">
              <div className="mb-1 flex justify-between text-[12px] text-ink-3">
                <span>Today</span>
                <span className="tabular-nums">
                  {doneToday} of {dayTotal} done
                </span>
              </div>
              <DayBar done={doneToday} total={dayTotal} />
            </div>
          )}
        </div>
        <div ref={listRef} className="mt-3 grid min-h-0 flex-1 grid-cols-3 gap-5">
          <Column title="Today" count={due.length} tone={overdue.length ? "danger" : undefined}>
            {due.length ? (
              <Rows tasks={due} fit={fit - 1} today={today} isDone={isDone} toggle={toggle} />
            ) : (
              <ColumnEmpty>Nothing due today.</ColumnEmpty>
            )}
          </Column>
          <Column title="Coming up" count={upcoming.length}>
            {upcoming.length ? (
              <Rows tasks={upcoming} fit={fit - 1} today={today} isDone={isDone} toggle={toggle} showDate />
            ) : (
              <ColumnEmpty>Nothing scheduled.</ColumnEmpty>
            )}
          </Column>
          <Column title="No date" count={inbox.length}>
            {inbox.length ? (
              <Rows tasks={inbox} fit={fit - 1} today={today} isDone={isDone} toggle={toggle} showProject />
            ) : (
              <ColumnEmpty>Inbox zero.</ColumnEmpty>
            )}
          </Column>
        </div>
      </div>
    );
  }

  // M and L: sectioned list. With nothing due today, show what's coming up instead.
  const sections: Section[] = due.length
    ? [
        ...(overdue.length && size === "l" ? [{ key: "overdue", title: "Overdue", tone: "danger" as const, tasks: overdue }] : []),
        ...(size === "l" ? [{ key: "today", title: "Today", tasks: dueToday }] : [{ key: "today", title: "", tasks: due }]),
        ...(size === "l" ? [{ key: "upcoming", title: "Coming up", tasks: upcoming.slice(0, 5) }] : []),
      ]
    : [{ key: "upcoming", title: "Nothing due today · coming up", tasks: upcoming }];
  const footer = [inbox.length ? `${inbox.length} with no date` : "", upcoming.length && size !== "l" && due.length ? `${upcoming.length} coming up` : ""]
    .filter(Boolean)
    .join(" · ");
  const showAdd = size === "l" || adding;
  const listFit = Math.max(1, fit);
  const { rows, more } = layoutSections(sections, listFit);
  const empty = !due.length && !upcoming.length;

  return (
    <div className="flex h-full flex-col">
      <WidgetHeader meta={meta} actions={size === "m" ? addAction : undefined} />
      {size === "l" && dayTotal > 0 && <DayBar done={doneToday} total={dayTotal} className="mt-1.5" />}
      {showAdd && <div className={size === "l" ? "mt-3" : "mt-1.5"}>{quickAdd(adding)}</div>}
      <div ref={listRef} className={`min-h-0 flex-1 overflow-hidden ${showAdd ? "mt-1.5" : "mt-1"}`}>
        {empty ? (
          <div className={`flex h-full items-center justify-center ${size === "l" ? "flex-col gap-1 text-center" : "gap-3"}`}>
            <KiwiSleeping animated size={size === "l" ? 132 : 76} className="shrink-0" />
            <div>
              <div className="text-[15px] font-medium">Nothing due today</div>
              <div className="mt-0.5 text-[13px] text-ink-3">{inbox.length ? `${inbox.length} waiting with no date` : "Enjoy the quiet."}</div>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col">
            <AnimatePresence initial={false}>
              {rows.map((r) =>
                r.kind === "heading" ? (
                  <li
                    key={r.key}
                    className={`flex h-8 items-end pb-1.5 text-[12px] font-semibold ${r.tone === "danger" ? "text-danger" : "text-gray-500"}`}
                  >
                    {r.title}
                  </li>
                ) : (
                  <TodayRow key={r.task.id} task={r.task} today={today} done={isDone(r.task)} onToggle={() => toggle(r.task)} />
                ),
              )}
            </AnimatePresence>
            {more > 0 && <li className="flex h-8 items-center text-[13px] text-gray-500">{more} more</li>}
          </ul>
        )}
      </div>
      {footer && <div className="mt-1 truncate text-[12px] text-ink-3">{footer}</div>}
    </div>
  );
}

type LaidRow = { kind: "heading"; key: string; title: string; tone?: "danger" } | { kind: "task"; task: Task };

/**
 * Flatten sections into rows that fit, keeping a line for "N more" and never
 * ending on a bare heading. When space is tight, coming up goes first, then
 * the headings, so the rows go to tasks.
 */
function layoutSections(sections: Section[], fit: number) {
  const flatten = (ss: Section[], headings: boolean): LaidRow[] =>
    ss
      .filter((s) => s.tasks.length)
      .flatMap((s) => [
        ...(headings && s.title ? [{ kind: "heading" as const, key: `h:${s.key}`, title: s.title, tone: s.tone }] : []),
        ...s.tasks.map((task) => ({ kind: "task" as const, task })),
      ]);
  const trimmed = sections.length > 1 ? sections.filter((s) => s.key !== "upcoming") : sections;
  const options = [flatten(sections, true), flatten(trimmed, true), flatten(trimmed, false)];
  const all = options.find((r) => r.length <= fit) ?? options[2];
  const total = all.filter((r) => r.kind === "task").length;
  let rows = all.length > fit ? all.slice(0, Math.max(1, fit - 1)) : all;
  while (rows.length && rows[rows.length - 1].kind === "heading") rows = rows.slice(0, -1);
  return { rows, more: total - rows.filter((r) => r.kind === "task").length };
}

/** Thin progress bar for the day: finished out of everything due. */
function DayBar({ done, total, className = "" }: { done: number; total: number; className?: string }) {
  if (!total) return null;
  return (
    <div
      className={`h-1.5 overflow-hidden rounded-full bg-gray-150 ${className}`}
      role="progressbar"
      aria-label="Done today"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
    >
      <motion.div
        className="h-full rounded-full bg-accent"
        initial={false}
        animate={{ width: `${(done / total) * 100}%` }}
        transition={{ type: "spring", duration: 0.5, bounce: 0 }}
      />
    </div>
  );
}

function Column({ title, count, tone, children }: { title: string; count: number; tone?: "danger"; children: ReactNode }) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col">
      <h3 className="flex h-8 shrink-0 items-center gap-1.5 border-b border-gray-150 text-[12px] font-semibold text-gray-500">
        <span className={tone === "danger" ? "text-danger" : ""}>{title}</span>
        <span className="font-medium tabular-nums text-ink-3">{count}</span>
      </h3>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

function ColumnEmpty({ children }: { children: ReactNode }) {
  return <p className="pt-2 text-[13px] text-ink-3">{children}</p>;
}

function Rows({
  tasks,
  fit,
  today,
  isDone,
  toggle,
  showDate = false,
  showProject = false,
}: {
  tasks: Task[];
  fit: number;
  today: string;
  isDone: (t: Task) => boolean;
  toggle: (t: Task) => void;
  showDate?: boolean;
  showProject?: boolean;
}) {
  const room = Math.max(1, fit);
  const shown = tasks.length > room ? tasks.slice(0, Math.max(1, room - 1)) : tasks;
  const more = tasks.length - shown.length;
  return (
    <ul className="flex flex-col">
      <AnimatePresence initial={false}>
        {shown.map((t) => (
          <TodayRow
            key={t.id}
            task={t}
            today={today}
            done={isDone(t)}
            onToggle={() => toggle(t)}
            showToday={showDate}
            showProject={showProject}
          />
        ))}
      </AnimatePresence>
      {more > 0 && <li className="flex h-8 items-center text-[13px] text-gray-500">{more} more</li>}
    </ul>
  );
}

function TodayRow({
  task,
  today,
  done,
  onToggle,
  showToday = false,
  showProject = false,
}: {
  task: Task;
  today: string;
  done: boolean;
  onToggle: () => void;
  showToday?: boolean;
  showProject?: boolean;
}) {
  const { index } = useProjects();
  const project = showProject && task.project_id ? index.get(task.project_id)?.project : null;
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      className="flex h-8 items-center gap-3"
    >
      <Checkbox checked={done} onToggle={onToggle} label={`Complete ${task.title}`} size={18} />
      <PriorityDot p={done ? 0 : task.priority} />
      <span
        className={`min-w-0 flex-1 truncate text-[15px] font-medium transition-colors duration-300 ${
          done ? "text-ink-3 line-through decoration-gray-400" : ""
        }`}
      >
        {task.title}
      </span>
      {project ? (
        <span className="flex min-w-0 max-w-[40%] shrink-0 items-center gap-1 text-[12.5px] text-gray-500">
          <Emoji emoji={project.emoji} size={12} />
          <span className="truncate">{project.name}</span>
        </span>
      ) : (
        !done && <DueMeta task={task} today={today} showToday={showToday} />
      )}
    </motion.li>
  );
}
