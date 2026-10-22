// Pure helpers for the Todoist-style Today view: ordering, the schedule quick
// picks, due-date tones and the P1 to P4 labels.

import type { Task } from "./dashboard-types";
import { addDays, daysBetween, weekdayOf } from "./time";
import { WEEKDAYS_SHORT, shortDate } from "./format";

/**
 * Priority is stored 0 to 3 (3 is the most urgent). Todoist counts the other
 * way, so stored 3 is P1 and stored 0 is P4 (no priority).
 */
export const PRIORITY_LEVELS = [
  { value: 3, label: "P1", name: "Priority 1" },
  { value: 2, label: "P2", name: "Priority 2" },
  { value: 1, label: "P3", name: "Priority 3" },
  { value: 0, label: "P4", name: "Priority 4" },
] as const;

export function priorityLabel(p: number) {
  return `P${4 - Math.max(0, Math.min(3, p))}`;
}

/** Within a day: timed tasks first in time order, then by priority, then position. */
export function sortDay(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const at = a.due_time?.slice(0, 5);
    const bt = b.due_time?.slice(0, 5);
    if (at && bt && at !== bt) return at.localeCompare(bt);
    if (!!at !== !!bt) return at ? -1 : 1;
    return b.priority - a.priority || a.position - b.position;
  });
}

/** Overdue rows: oldest day first, then the same order as a day. */
export function sortOverdue(tasks: Task[]): Task[] {
  const byDay = new Map<string, Task[]>();
  for (const t of tasks) byDay.set(t.due_date ?? "", [...(byDay.get(t.due_date ?? "") ?? []), t]);
  return [...byDay.keys()].sort().flatMap((d) => sortDay(byDay.get(d)!));
}

export type QuickDates = { today: string; tomorrow: string; weekend: string; nextWeek: string };

/** Dates behind the schedule menu: this weekend is Saturday, next week is Monday. */
export function quickDates(today: string): QuickDates {
  const wd = weekdayOf(today);
  return {
    today,
    tomorrow: addDays(today, 1),
    weekend: addDays(today, wd === 6 ? 0 : (6 - wd + 7) % 7),
    nextWeek: addDays(today, ((1 - wd + 7) % 7) || 7),
  };
}

export type DueTone = "overdue" | "today" | "tomorrow" | "later";

export function dueTone(due: string, today: string): DueTone {
  const n = daysBetween(today, due);
  return n < 0 ? "overdue" : n === 0 ? "today" : n === 1 ? "tomorrow" : "later";
}

/** "Thu Oct 22" for section headings. */
export function dayHeading(date: string): string {
  return shortDate(date).replace(",", "");
}

/** Short weekday for menu hints: "Thu". */
export function weekdayShort(date: string): string {
  return WEEKDAYS_SHORT[weekdayOf(date)];
}

/** Days from today through the next `n`, for the Upcoming peek. */
export function nextDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i + 1));
}
