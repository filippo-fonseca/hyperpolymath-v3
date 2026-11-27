import { z } from "zod";
import type { Accent, CustomKind } from "./widgets";
import {
  activityByActor,
  capturesDaily,
  dayRange,
  focusByArea,
  focusByProject,
  habitRateDaily,
  habitStats,
  hourLabel,
  hoursOf,
  rhythm,
  routineHealth,
  tasksDoneDaily,
  weekdaysOf,
  type InsightsRaw,
  type Slice,
} from "./insights";
import { addDays } from "./time";

// Live widgets: the app fills them from its own data instead of a bot
// publishing a payload. A widget stores a source (what to measure, over how
// many days) and a kind (how to draw it); the payload is computed on read,
// so it is always current and never goes stale.

export const SOURCE_IDS = [
  "tasks_done",
  "tasks_open",
  "habits_rate",
  "habits_today",
  "habit_streaks",
  "focus_projects",
  "focus_areas",
  "captures",
  "rhythm_hours",
  "rhythm_weekdays",
  "teammates",
  "routines",
] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

export const sourceSchema = z.object({
  id: z.enum(SOURCE_IDS),
  days: z.number().int().min(7).max(365).optional().describe("Window in days (default 30)"),
  habit: z.string().uuid().optional().describe("habits_rate only: one habit instead of all"),
});
export type WidgetSource = z.infer<typeof sourceSchema>;

export type SourceInfo = {
  label: string;
  blurb: string;
  group: "Tasks" | "Habits" | "Captures" | "Rhythm" | "Teammates";
  kinds: CustomKind[];
  accent: Accent;
  /** False when the window doesn't change anything (today's habits, open tasks). */
  windowed: boolean;
};

export const SOURCE_INFO: Record<SourceId, SourceInfo> = {
  tasks_done: { label: "Tasks completed", blurb: "How many tasks you finish each day.", group: "Tasks", kinds: ["bar", "line", "heatmap", "stat"], accent: "blue", windowed: true },
  tasks_open: { label: "Open tasks", blurb: "What's on your plate, and what's overdue.", group: "Tasks", kinds: ["stat", "donut"], accent: "blue", windowed: false },
  focus_projects: { label: "Focus by project", blurb: "Where your finished tasks went.", group: "Tasks", kinds: ["donut", "bar"], accent: "purple", windowed: true },
  focus_areas: { label: "Focus by area", blurb: "School, health, work: the balance of your effort.", group: "Tasks", kinds: ["donut", "bar"], accent: "purple", windowed: true },
  habits_rate: { label: "Habit consistency", blurb: "Share of scheduled habits you kept, per day.", group: "Habits", kinds: ["line", "heatmap", "bar", "stat"], accent: "green", windowed: true },
  habits_today: { label: "Today's habits", blurb: "Rings for each habit due today.", group: "Habits", kinds: ["progress"], accent: "green", windowed: false },
  habit_streaks: { label: "Streaks", blurb: "Current streak against your best, per habit.", group: "Habits", kinds: ["progress", "bar"], accent: "orange", windowed: false },
  captures: { label: "Captures", blurb: "Ideas and links you saved, per day.", group: "Captures", kinds: ["bar", "line", "heatmap", "stat"], accent: "orange", windowed: true },
  rhythm_hours: { label: "Peak hours", blurb: "When in the day you finish things.", group: "Rhythm", kinds: ["bar"], accent: "teal", windowed: true },
  rhythm_weekdays: { label: "Best days", blurb: "Which weekdays you get the most done.", group: "Rhythm", kinds: ["bar", "donut"], accent: "teal", windowed: true },
  teammates: { label: "Bot activity", blurb: "What your bots and you changed, per day.", group: "Teammates", kinds: ["bar", "donut", "stat"], accent: "purple", windowed: true },
  routines: { label: "Routine health", blurb: "How your bots' scheduled runs went.", group: "Teammates", kinds: ["donut", "stat"], accent: "teal", windowed: true },
};

export const DEFAULT_DAYS = 30;

/** Days of data a set of sources needs (twice the window, for the previous-period comparison). */
export function daysNeeded(sources: WidgetSource[]) {
  return Math.min(730, Math.max(14, ...sources.map((s) => 2 * (s.days ?? DEFAULT_DAYS))));
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function delta(now: number, before: number, unit = "") {
  const d = Math.round((now - before) * 10) / 10;
  return d === 0 ? "±0" : `${d > 0 ? "+" : ""}${d}${unit}`;
}

/** A per-day series drawn as the chosen kind. */
function daily(kind: CustomKind, name: string, values: (number | null)[], prev: (number | null)[], start: string, opts: { unit?: string; avg?: boolean; label: string; accent: Accent }) {
  const nums = values.filter((v): v is number => v !== null);
  const prevNums = prev.filter((v): v is number => v !== null);
  const total = opts.avg ? (nums.length ? Math.round(sum(nums) / nums.length) : 0) : sum(nums);
  const before = opts.avg ? (prevNums.length ? Math.round(sum(prevNums) / prevNums.length) : 0) : sum(prevNums);
  const range = values.length;
  switch (kind) {
    case "stat": {
      // Weekly buckets read better than a jagged daily sparkline.
      const step = range > 21 ? 7 : 1;
      const trend: number[] = [];
      for (let i = range % step; i < range; i += step) {
        const chunk = values.slice(i, i + step).filter((v): v is number => v !== null);
        trend.push(opts.avg ? (chunk.length ? sum(chunk) / chunk.length : 0) : sum(chunk));
      }
      return { value: total, unit: opts.unit, label: `${opts.label}, last ${range} days`, delta: delta(total, before, opts.unit ?? ""), trend, accent: opts.accent };
    }
    case "heatmap":
      return { start, values, label: name.toLowerCase(), accent: opts.accent, ...(opts.avg ? { max: 100 } : {}) };
    case "line":
      return {
        series: [{ name, values }],
        start,
        step: "day" as const,
        unit: opts.unit,
        summary: { value: `${total}${opts.unit ?? ""}`, label: opts.avg ? "average" : "total", delta: delta(total, before, opts.unit ?? "") },
        accent: opts.accent,
      };
    default:
      // Long windows become weekly bars so they stay legible.
      if (range > 45) {
        const weeks: number[] = [];
        const first = range % 7;
        for (let i = first; i < range; i += 7) {
          const chunk = values.slice(i, i + 7).filter((v): v is number => v !== null);
          weeks.push(opts.avg ? (chunk.length ? Math.round(sum(chunk) / chunk.length) : 0) : sum(chunk));
        }
        return { series: [{ name, values: weeks }], start: addDays(start, first), step: "week" as const, unit: opts.unit, accent: opts.accent };
      }
      return { series: [{ name, values }], start, step: "day" as const, unit: opts.unit, accent: opts.accent };
  }
}

function slices(kind: CustomKind, name: string, items: Slice[], opts: { unit?: string; accent: Accent; center?: string }) {
  if (kind === "donut") {
    return {
      segments: items.length ? items.map((s) => ({ label: s.emoji ? `${s.emoji} ${s.label}` : s.label, value: s.value })) : [{ label: "Nothing yet", value: 0 }],
      center: { value: sum(items.map((s) => s.value)), label: opts.center ?? name.toLowerCase() },
      unit: opts.unit,
      accent: opts.accent,
    };
  }
  return {
    series: [{ name, values: items.length ? items.map((s) => s.value) : [0] }],
    labels: items.length ? items.map((s) => (s.emoji ? `${s.emoji} ${s.label}` : s.label)) : ["Nothing yet"],
    horizontal: true,
    unit: opts.unit,
    accent: opts.accent,
  };
}

/** Compute a live widget's payload from the app's own data. */
export function resolveSource(raw: InsightsRaw, source: WidgetSource, kind: CustomKind): unknown {
  const info = SOURCE_INFO[source.id];
  const n = info.windowed ? (source.days ?? DEFAULT_DAYS) : DEFAULT_DAYS;
  const days = dayRange(raw.today, n);
  const prev = dayRange(addDays(raw.today, -n), n);
  const start = days[0];
  const accent = info.accent;
  switch (source.id) {
    case "tasks_done":
      return daily(kind, "Tasks done", tasksDoneDaily(raw, days), tasksDoneDaily(raw, prev), start, { label: "Tasks done", accent });
    case "captures":
      return daily(kind, "Captures", capturesDaily(raw, days), capturesDaily(raw, prev), start, { label: "Captures", accent });
    case "habits_rate": {
      const habit = source.habit ? raw.habits.find((h) => h.id === source.habit) : undefined;
      const name = habit ? habit.name : "Habits kept";
      return daily(kind, name, habitRateDaily(raw, days, habit?.id), habitRateDaily(raw, prev, habit?.id), start, { unit: "%", avg: true, label: name, accent });
    }
    case "tasks_open": {
      const open = raw.tasks.filter((t) => t.status !== "done");
      const overdue = open.filter((t) => t.due_date && t.due_date < raw.today).length;
      const today = open.filter((t) => t.due_date === raw.today).length;
      const later = open.length - overdue - today;
      if (kind === "donut") {
        return {
          segments: [
            { label: "Overdue", value: overdue, color: "red" as const },
            { label: "Today", value: today, color: "blue" as const },
            { label: "Later or undated", value: later, color: "gray" as const },
          ],
          center: { value: open.length, label: "open" },
        };
      }
      return { value: open.length, label: overdue ? `open, ${overdue} overdue` : "open tasks", accent: overdue ? ("red" as const) : accent };
    }
    case "habits_today": {
      const due = habitStats(raw, days).filter((h) => h.scheduledToday);
      if (!due.length) return { items: [{ label: "Nothing due today", value: 0, target: 1 }], style: "bars" as const, accent };
      return { items: due.slice(0, 8).map((h) => ({ label: h.name, value: h.today, target: 3, icon: h.icon ?? undefined })), style: due.length > 4 ? ("bars" as const) : ("rings" as const), accent };
    }
    case "habit_streaks": {
      const hs = habitStats(raw, days).sort((a, b) => b.streak - a.streak).slice(0, 8);
      if (kind === "bar") return slices("bar", "Streak", hs.map((h) => ({ label: h.name, value: h.streak, emoji: h.icon })), { unit: "d", accent });
      if (!hs.length) return { items: [{ label: "No habits yet", value: 0, target: 1 }], style: "bars" as const, accent };
      return { items: hs.map((h) => ({ label: h.name, value: h.streak, target: Math.max(h.best, 1), unit: "d", icon: h.icon ?? undefined })), style: "bars" as const, accent, footnote: "Current streak against your best" };
    }
    case "focus_projects":
      return slices(kind, "Tasks", focusByProject(raw, days), { accent, center: "done" });
    case "focus_areas":
      return slices(kind, "Tasks", focusByArea(raw, days), { accent, center: "done" });
    case "rhythm_hours": {
      const hours = hoursOf(rhythm(raw, days));
      // 6am to midnight keeps the bars wide enough to read; night owls still show at 11pm.
      const from = hours.slice(0, 6).some((v) => v > 0) ? 0 : 6;
      return { series: [{ name: "Tasks done", values: hours.slice(from) }], labels: hours.slice(from).map((_, i) => hourLabel(i + from)), accent };
    }
    case "rhythm_weekdays": {
      const wd = weekdaysOf(rhythm(raw, days));
      const order = [1, 2, 3, 4, 5, 6, 0];
      if (kind === "donut") return slices("donut", "Tasks", order.map((d) => ({ label: WEEKDAYS[d], value: wd[d] })), { accent, center: "done" });
      return { series: [{ name: "Tasks done", values: order.map((d) => wd[d]) }], labels: order.map((d) => WEEKDAYS[d]), accent };
    }
    case "teammates": {
      const actors = activityByActor(raw, days);
      if (kind === "donut") return slices("donut", "Changes", actors.map((a) => ({ label: a.name, value: a.total })), { accent, center: "changes" });
      if (kind === "stat") {
        const bots = actors.filter((a) => a.id !== null);
        const before = activityByActor(raw, prev).filter((a) => a.id !== null);
        const total = sum(bots.map((b) => b.total));
        return { value: total, label: `changes by bots, last ${n} days`, delta: delta(total, sum(before.map((b) => b.total))), accent };
      }
      const palette: Accent[] = ["purple", "blue", "teal", "orange", "pink", "gray"];
      return {
        series: actors.length ? actors.map((a, i) => ({ name: a.name, values: a.values, color: a.id === null ? ("gray" as const) : palette[i % palette.length] })) : [{ name: "Changes", values: days.map(() => 0) }],
        start,
        step: "day" as const,
        stacked: true,
        accent,
      };
    }
    case "routines": {
      const h = routineHealth(raw, days);
      const total = h.ok + h.error + h.skipped;
      if (kind === "stat") {
        return { value: total ? Math.round((h.ok / total) * 100) : 0, unit: "%", label: `of ${total} runs succeeded, last ${n} days`, accent: h.error ? ("orange" as const) : accent };
      }
      return {
        segments: [
          { label: "Succeeded", value: h.ok, color: "green" as const },
          { label: "Failed", value: h.error, color: "red" as const },
          { label: "Skipped", value: h.skipped, color: "gray" as const },
        ],
        center: { value: total, label: "runs" },
      };
    }
  }
}
