"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import type { Task } from "@/lib/dashboard-types";
import type { WidgetSize } from "@/lib/widgets";
import { dayHeading } from "@/lib/today";
import { IconPlus } from "@/components/ui/icons";
import { KiwiSleeping } from "@/components/illustrations";
import { HeaderAction, WidgetHeader } from "@/components/dashboard/widget-chrome";
import { ROW_HEIGHTS, TaskSheet, TodayRow, useRowMeta, type RowVariant } from "./today-row";
import { AddTaskButton, TaskComposer } from "./task-composer";
import { RescheduleButton, TodayEmpty, useQuickAddKey, useTodayData } from "./today-list";
import { useTasks } from "./use-tasks";

type Ops = ReturnType<typeof useTasks>;

type Item =
  | { kind: "heading"; key: string; title: string; tone?: "danger"; reschedule?: Task[] }
  | { kind: "task"; task: Task; hideToday?: boolean; hideDate?: boolean; h: number }
  | { kind: "add" };

const HEADING_H = 32;
const ADD_H = 40;
const MORE_H = 32;

const heightOf = (i: Item) => (i.kind === "heading" ? HEADING_H : i.kind === "add" ? ADD_H : i.h);
const sum = (items: Item[]) => items.reduce((n, i) => n + heightOf(i), 0);
const tasksIn = (items: Item[]) => items.filter((i) => i.kind === "task").length;

/**
 * Fit rows into the card's height. The add row goes first when space runs
 * out, then rows give way to an "N more" line; a heading never ends the list,
 * and at least one task always shows.
 */
function fit(items: Item[], budget: number) {
  if (sum(items) <= budget) return { shown: items, more: 0 };
  const rows = items.filter((i) => i.kind !== "add");
  if (sum(rows) <= budget) return { shown: rows, more: 0 };
  const shown: Item[] = [];
  let used = MORE_H;
  for (const i of rows) {
    if (used + heightOf(i) > budget) break;
    shown.push(i);
    used += heightOf(i);
  }
  while (shown.length && shown[shown.length - 1].kind === "heading") shown.pop();
  if (!tasksIn(shown)) {
    const first = rows.find((i) => i.kind === "task");
    if (first) return { shown: [first], more: tasksIn(rows) - 1 };
  }
  return { shown, more: tasksIn(rows) - tasksIn(shown) };
}

/** Height of an element, kept current as the card resizes. */
function useHeight(fallback: number) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [h, setH] = useState(fallback);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setH(e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, h] as const;
}

/** Today on the dashboard: the same rows and composer as the full view, fitted to the card. */
export function TasksWidget({ size }: { size: WidgetSize }) {
  const ops = useTasks();
  const d = useTodayData(ops);
  const rowMeta = useRowMeta();
  const [adding, setAdding] = useState(false);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useQuickAddKey(() => setAdding(true), root, size !== "s");

  const small = size === "s";
  const variant: RowVariant = size === "l" || size === "w" ? "card" : "dense";
  const sheetTask = sheetId ? ([...ops.open, ...ops.done].find((t) => t.id === sheetId) ?? null) : null;
  const overdue = d.overdue.length;

  const taskItem = (task: Task, extra: { hideToday?: boolean; hideDate?: boolean } = {}, v: RowVariant = variant): Item => ({
    kind: "task",
    task,
    ...extra,
    // A small card only has room for titles; its header already counts what's overdue.
    ...(small ? { hideDate: true } : {}),
    h: v === "card" && rowMeta(task, extra).any ? ROW_HEIGHTS.card : ROW_HEIGHTS.dense,
  });
  const headings = size !== "s" && (size !== "m" || overdue > 0);
  const todayItems: Item[] = [
    ...(overdue && headings ? [{ kind: "heading" as const, key: "overdue", title: "Overdue", tone: "danger" as const, reschedule: d.overdue }] : []),
    ...d.overdue.map((t) => taskItem(t)),
    ...(headings && d.dueToday.length ? [{ kind: "heading" as const, key: "today", title: size === "m" ? "Today" : `Today · ${dayHeading(ops.today)}` }] : []),
    ...d.dueToday.map((t) => taskItem(t, { hideToday: true })),
    ...(small ? [] : [{ kind: "add" as const }]),
  ];
  const upcomingItems: Item[] = d.upcoming
    .filter((day) => day.tasks.length)
    .flatMap((day) => [
      { kind: "heading" as const, key: day.date, title: day.date === d.upcoming[0].date ? `${dayHeading(day.date)} · Tomorrow` : dayHeading(day.date) },
      ...day.tasks.map((t) => taskItem(t, { hideDate: true }, "dense")),
    ]);

  const meta = (
    <>
      {overdue > 0 && <span className="text-danger">{overdue} overdue</span>}
      {overdue > 0 && <span className="text-gray-300">·</span>}
      <span>{d.left ? `${d.left} left` : d.completed.length ? "Done for today" : ""}</span>
    </>
  );

  return (
    <div ref={root} className="flex h-full flex-col">
      <WidgetHeader
        meta={meta}
        actions={
          small ? undefined : (
            <HeaderAction label="Add a task" onClick={() => setAdding((v) => !v)}>
              <IconPlus size={16} strokeWidth={2} />
            </HeaderAction>
          )
        }
      />
      {adding && !small ? (
        <div className="-mx-px mt-2 min-h-0 flex-1 overflow-y-auto p-px">
          <TaskComposer ops={ops} defaultDate={ops.today} onClose={() => setAdding(false)} compact />
        </div>
      ) : size === "w" ? (
        <div className="mt-1 grid min-h-0 flex-1 grid-cols-2 gap-6">
          <Column ops={ops} items={todayItems} empty={d.left === 0} finished={d.completed.length} onOpen={setSheetId} onAdd={() => setAdding(true)} size={size} />
          <div className="flex min-h-0 flex-col">
            <div className="flex h-8 shrink-0 items-center text-[12px] font-semibold text-gray-500">Upcoming</div>
            {upcomingItems.length ? (
              <Column ops={ops} items={upcomingItems} onOpen={setSheetId} size={size} />
            ) : (
              <p className="pt-1 text-[13px] text-ink-3">Nothing in the next week.</p>
            )}
          </div>
        </div>
      ) : (
        <Column
          ops={ops}
          items={todayItems}
          empty={d.left === 0}
          finished={d.completed.length}
          onOpen={setSheetId}
          onAdd={() => setAdding(true)}
          size={size}
          className={small ? "mt-0.5" : "mt-1"}
        />
      )}
      <TaskSheet task={sheetTask} ops={ops} onClose={() => setSheetId(null)} />
    </div>
  );
}

function Column({
  ops,
  items,
  size,
  onOpen,
  onAdd,
  empty = false,
  finished = 0,
  className = "",
}: {
  ops: Ops;
  items: Item[];
  size: WidgetSize;
  onOpen: (id: string) => void;
  onAdd?: () => void;
  empty?: boolean;
  finished?: number;
  className?: string;
}) {
  const [ref, height] = useHeight(size === "l" ? 300 : size === "w" ? 220 : 90);
  const variant: RowVariant = size === "l" || size === "w" ? "card" : "dense";

  if (empty && !tasksIn(items)) {
    return (
      <div ref={ref} className={`flex min-h-0 flex-1 flex-col ${className}`}>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          {size === "s" ? (
            <div className="flex flex-col items-center text-center">
              <KiwiSleeping animated size={64} />
              <div className="mt-0.5 text-[13px] font-medium">Nothing left today</div>
            </div>
          ) : (
            <TodayEmpty finished={finished} size={size === "m" ? 72 : height > 260 ? 128 : 88} inline={size === "m"} />
          )}
        </div>
        {onAdd && size !== "s" && height > 150 && <AddTaskButton onClick={onAdd} />}
      </div>
    );
  }

  const { shown, more } = fit(items, height);
  return (
    <div ref={ref} className={`min-h-0 flex-1 overflow-hidden ${className}`}>
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {shown.map((i) =>
            i.kind === "heading" ? (
              <li
                key={`h:${i.key}`}
                className={`flex h-8 items-center gap-2 text-[12px] font-semibold ${i.tone === "danger" ? "text-danger" : "text-gray-500"}`}
              >
                <span className="truncate">{i.title}</span>
                {i.reschedule && <RescheduleButton ops={ops} tasks={i.reschedule} className="-mr-2 ml-auto text-[12px]" />}
              </li>
            ) : i.kind === "add" ? (
              <li key="add">{onAdd && <AddTaskButton onClick={onAdd} />}</li>
            ) : (
              <TodayRow
                key={i.task.id}
                task={i.task}
                ops={ops}
                variant={i.hideDate ? "dense" : variant}
                hideToday={i.hideToday}
                hideDate={i.hideDate}
                onOpen={() => onOpen(i.task.id)}
              />
            ),
          )}
        </AnimatePresence>
        {more > 0 && <li className="flex h-8 items-center text-[13px] text-gray-500">{more} more</li>}
      </ul>
    </div>
  );
}
