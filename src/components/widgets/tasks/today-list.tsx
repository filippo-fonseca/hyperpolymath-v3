"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { AnimatePresence } from "motion/react";
import type { Task } from "@/lib/dashboard-types";
import { localDate } from "@/lib/time";
import { pluralize, weekdayName } from "@/lib/format";
import { dayHeading, nextDays } from "@/lib/today";
import { DEFAULT_VIEWS, filterTasks, groupSections, sortTasks, type TaskViewPrefs } from "@/lib/task-view";
import { IconChevronDown } from "@/components/ui/icons";
import { KiwiSleeping } from "@/components/illustrations";
import { useDashboard } from "@/components/dashboard/context";
import { TodayRow } from "./today-row";
import { AddTaskButton, TaskComposer } from "./task-composer";
import type { useTasks } from "./use-tasks";
import { useTaskView } from "./use-task-view";
import { FilteredOut } from "./view-options";

type Ops = ReturnType<typeof useTasks>;

/**
 * What the Today view shows, sorted and filtered by the tab's view options.
 * Rows leave as soon as they're checked (the server catches up a moment
 * later) and come back when unchecked, so the lists never wait on a refresh.
 * `left` counts everything due, filtered or not; `hidden` is what filters hide.
 */
export function useTodayData(ops: Ops, prefs: TaskViewPrefs = DEFAULT_VIEWS.today) {
  const { data } = useDashboard();
  const { open, done, isDone, today } = ops;
  return useMemo(() => {
    const openIds = new Set(open.map((t) => t.id));
    // Still open, plus finished ones just unchecked here.
    const pool = [...open.filter((t) => !isDone(t)), ...done.filter((t) => !isDone(t) && !openIds.has(t.id))];
    const shown = filterTasks(pool, prefs, today);
    const sort = (tasks: Task[]) => sortTasks(tasks, prefs.sort, prefs.dir);
    const overdue = sort(shown.filter((t) => t.due_date && t.due_date < today));
    const dueToday = sort(shown.filter((t) => t.due_date === today));
    const due = pool.filter((t) => t.due_date && t.due_date <= today).length;
    const seen = new Set<string>();
    const completed = [
      // Just ticked here; recurring ones roll forward instead of finishing.
      ...open.filter((t) => isDone(t) && !t.recurrence && t.due_date && t.due_date <= today),
      ...done.filter((t) => isDone(t) && t.completed_at && localDate(new Date(t.completed_at), data.tz) === today),
    ].filter((t) => !seen.has(t.id) && !!seen.add(t.id));
    const upcoming = nextDays(today, 7).map((date) => ({ date, tasks: sort(shown.filter((t) => t.due_date === date)) }));
    const week = new Set(upcoming.map((d) => d.date));
    const inWeek = (tasks: Task[]) => tasks.filter((t) => t.due_date && week.has(t.due_date)).length;
    return {
      overdue,
      dueToday,
      completed,
      upcoming,
      left: due,
      hidden: due - overdue.length - dueToday.length,
      upcomingHidden: inWeek(pool) - inWeek(shown),
    };
  }, [open, done, isDone, today, data.tz, prefs]);
}

// Only the most recently mounted Today list answers the shortcut.
const quickAddLayers: { current: () => void; el?: RefObject<HTMLElement | null> }[] = [];

/**
 * `q` or `a` opens quick add when nothing is being typed into and no sheet or
 * menu is open. A card under another widget's full view stays quiet.
 */
export function useQuickAddKey(open: () => void, el?: RefObject<HTMLElement | null>, enabled = true) {
  const handler = useRef(open);
  useEffect(() => {
    handler.current = open;
  });
  useEffect(() => {
    if (!enabled) return;
    const layer = { current: () => handler.current(), el };
    quickAddLayers.push(layer);
    const onKey = (e: KeyboardEvent) => {
      if (quickAddLayers[quickAddLayers.length - 1] !== layer) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || (e.key !== "q" && e.key !== "a")) return;
      if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable=true]")) return;
      if (document.querySelector("[role=dialog], [role=menu]")) return;
      const full = document.querySelector('[role=region][aria-label="Full view"]');
      const mine = layer.el?.current;
      if (full && (!mine || !full.contains(mine))) return;
      e.preventDefault();
      layer.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const i = quickAddLayers.indexOf(layer);
      if (i >= 0) quickAddLayers.splice(i, 1);
    };
  }, [enabled, el]);
}

export function SectionHeading({
  title,
  count,
  tone,
  action,
  className = "",
}: {
  title: ReactNode;
  count?: number;
  tone?: "danger";
  action?: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={`flex min-h-10 items-center gap-2 border-b border-gray-150 text-[14px] font-semibold ${className}`}>
      <span className={`min-w-0 truncate ${tone === "danger" ? "text-danger" : ""}`}>{title}</span>
      {count !== undefined && count > 0 && <span className="text-[12.5px] font-medium tabular-nums text-ink-3">{count}</span>}
      {action && <span className="ml-auto shrink-0">{action}</span>}
    </h3>
  );
}

/** The overdue heading's "Reschedule": everything overdue moves to today. */
export function RescheduleButton({ ops, tasks, className = "" }: { ops: Ops; tasks: Task[]; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void ops.reschedule(tasks, ops.today, "today");
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`h-10 rounded-full px-2 text-[13px] font-medium text-accent transition hover:bg-accent-soft [@media(hover:hover)]:h-8 ${className}`}
    >
      Reschedule
    </button>
  );
}

/** Nothing left today: Kiwi asleep and one plain line. */
export function TodayEmpty({ finished, size = 150, inline = false }: { finished: number; size?: number; inline?: boolean }) {
  return (
    <div className={inline ? "flex items-center gap-3" : "flex flex-col items-center py-6 text-center"}>
      <KiwiSleeping animated size={size} className="shrink-0" />
      <div className={inline ? "min-w-0" : "mt-1"}>
        <div className="text-[15px] font-medium">{finished ? "That's everything for today" : "Nothing on for today"}</div>
        <div className="mt-0.5 text-[13px] text-ink-3">
          {finished ? `You finished ${pluralize(finished, "task")}.` : "Add a task if something comes up."}
        </div>
      </div>
    </div>
  );
}

function Rows({ tasks, ops, openId, setOpenId, hideToday, hideDate }: {
  tasks: Task[];
  ops: Ops;
  openId: string | null;
  setOpenId: (fn: (id: string | null) => string | null) => void;
  hideToday?: boolean;
  hideDate?: boolean;
}) {
  return (
    <ul>
      <AnimatePresence initial={false}>
        {tasks.map((t) => (
          <TodayRow
            key={t.id}
            task={t}
            ops={ops}
            hideToday={hideToday}
            hideDate={hideDate}
            expanded={openId === t.id}
            onOpen={() => setOpenId((id) => (id === t.id ? null : t.id))}
          />
        ))}
      </AnimatePresence>
    </ul>
  );
}

/** The full-page Today: Overdue, Today with its inline composer, then what's done. */
export function TodayList({ ops, options }: { ops: Ops; options: ReturnType<typeof useTaskView> }) {
  const { prefs } = options;
  const d = useTodayData(ops, prefs);
  const { data } = useDashboard();
  const sections = groupSections(d.dueToday, prefs.group, ops.today, data.areas);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useQuickAddKey(() => setAdding(true), root);

  return (
    <div ref={root} className="flex flex-col gap-8">
      {d.hidden > 0 && d.hidden < d.left && <HiddenNote hidden={d.hidden} when="today" options={options} />}
      {d.overdue.length > 0 && (
        <section>
          <SectionHeading title="Overdue" tone="danger" count={d.overdue.length} action={<RescheduleButton ops={ops} tasks={d.overdue} />} />
          <Rows tasks={d.overdue} ops={ops} openId={openId} setOpenId={setOpenId} />
        </section>
      )}
      <section>
        <SectionHeading title={`Today · ${dayHeading(ops.today)}`} count={d.dueToday.length} />
        {sections.map((s) => (
          <div key={s.key}>
            {s.title && <SubHeading title={s.title} emoji={s.emoji} count={s.tasks.length} />}
            <Rows tasks={s.tasks} ops={ops} openId={openId} setOpenId={setOpenId} hideToday />
          </div>
        ))}
        <div className="mt-1.5">
          {adding ? (
            <TaskComposer ops={ops} defaultDate={ops.today} onClose={() => setAdding(false)} />
          ) : (
            <AddTaskButton onClick={() => setAdding(true)} />
          )}
        </div>
        {d.left === 0 && !adding && <TodayEmpty finished={d.completed.length} />}
        {d.left > 0 && d.hidden === d.left && !adding && <FilteredOut hidden={d.hidden} onClear={() => clearFilters(options)} />}
      </section>
      {d.completed.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
            className="flex h-10 items-center gap-1.5 text-[13.5px] font-semibold text-gray-500 transition hover:text-ink"
          >
            <IconChevronDown size={15} className={`transition-transform duration-200 ${showDone ? "" : "-rotate-90"}`} />
            Completed today
            <span className="font-medium tabular-nums text-ink-3">({d.completed.length})</span>
          </button>
          {showDone && <Rows tasks={d.completed} ops={ops} openId={openId} setOpenId={setOpenId} />}
        </section>
      )}
    </div>
  );
}

/** The next seven days, a heading per day and an add row under each. */
export function UpcomingList({ ops, options }: { ops: Ops; options: ReturnType<typeof useTaskView> }) {
  const d = useTodayData(ops, options.prefs);
  const [openId, setOpenId] = useState<string | null>(null);
  const [addingOn, setAddingOn] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useQuickAddKey(() => setAddingOn(d.upcoming[0].date), root);

  return (
    <div ref={root} className="flex flex-col gap-7">
      {d.upcomingHidden > 0 && <HiddenNote hidden={d.upcomingHidden} when="this week" options={options} />}
      {d.upcoming.map(({ date, tasks }, i) => (
        <section key={date}>
          <SectionHeading title={`${dayHeading(date)} · ${i === 0 ? "Tomorrow" : weekdayName(date)}`} count={tasks.length} />
          <Rows tasks={tasks} ops={ops} openId={openId} setOpenId={setOpenId} hideDate />
          <div className="mt-1">
            {addingOn === date ? (
              <TaskComposer ops={ops} defaultDate={date} onClose={() => setAddingOn(null)} />
            ) : (
              <AddTaskButton onClick={() => setAddingOn(date)} />
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

/** A band inside a section when Today is grouped (Priority 1, a project). */
function SubHeading({ title, emoji, count }: { title: string; emoji?: string | null; count: number }) {
  return (
    <div className="flex h-8 items-center gap-1.5 pt-2 text-[12.5px] font-semibold text-gray-500">
      {emoji && <span className="leading-none">{emoji}</span>}
      <span className="truncate">{title}</span>
      <span className="font-medium tabular-nums text-ink-3">{count}</span>
    </div>
  );
}

export function clearFilters(options: ReturnType<typeof useTaskView>) {
  options.set({ priorities: [], project: null, due: "any" });
}

/** One quiet line when filters hide some (not all) of a list. */
function HiddenNote({ hidden, when, options }: { hidden: number; when: string; options: ReturnType<typeof useTaskView> }) {
  return (
    <p className="-mb-4 text-[13px] text-ink-3">
      Filters hide {pluralize(hidden, "task")} {when}.{" "}
      <button type="button" onClick={() => clearFilters(options)} className="font-medium text-accent hover:underline">
        Clear filters
      </button>
    </p>
  );
}
