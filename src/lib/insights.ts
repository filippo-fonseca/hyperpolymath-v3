import { currentStreak } from "./streak";
import { addDays, daysBetween, localDate, weekdayOf, zonedParts, type LocalDate } from "./time";

// Analytics from the rows the app already keeps: tasks, habit logs, captures,
// the action log and routine runs. Pure functions over plain rows, so the
// Insights page and live widgets share one implementation, and tests need no
// database.

export type RawTask = {
  created_at: string;
  completed_at: string | null;
  status: string;
  project_id: string | null;
  due_date: string | null;
};
export type RawHabit = { id: string; name: string; icon: string | null; days_of_week: number[]; created_at: string; archived_at: string | null };
export type RawHabitLog = { habit_id: string; date: string; progress: number };
export type RawAction = { created_at: string; actor_kind: string; bot_id: string | null };
export type RawRun = { started_at: string; status: string };
export type RawBot = { id: string; name: string; avatar_color: string };
export type RawProject = { id: string; name: string; emoji: string | null; area_id: string | null };
export type RawArea = { id: string; name: string; emoji: string | null };

export type InsightsRaw = {
  tz: string;
  today: LocalDate;
  tasks: RawTask[];
  habits: RawHabit[];
  habitLogs: RawHabitLog[];
  captures: { created_at: string }[];
  actions: RawAction[];
  runs: RawRun[];
  bots: RawBot[];
  projects: RawProject[];
  areas: RawArea[];
};

/** The last `n` local days, oldest first, ending today. */
export function dayRange(today: LocalDate, n: number): LocalDate[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
}

/** Count instants per local day across `days`. */
function perDay(isos: (string | null)[], days: LocalDate[], tz: string): number[] {
  const index = new Map(days.map((d, i) => [d, i]));
  const out = days.map(() => 0);
  for (const iso of isos) {
    if (!iso) continue;
    const i = index.get(localDate(new Date(iso), tz));
    if (i !== undefined) out[i]++;
  }
  return out;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function tasksDoneDaily(raw: InsightsRaw, days: LocalDate[]) {
  return perDay(
    raw.tasks.map((t) => (t.status === "done" ? t.completed_at : null)),
    days,
    raw.tz,
  );
}

export function tasksCreatedDaily(raw: InsightsRaw, days: LocalDate[]) {
  return perDay(
    raw.tasks.map((t) => t.created_at),
    days,
    raw.tz,
  );
}

export function capturesDaily(raw: InsightsRaw, days: LocalDate[]) {
  return perDay(
    raw.captures.map((c) => c.created_at),
    days,
    raw.tz,
  );
}

/** Habits that existed (and weren't archived yet) on a given day and were scheduled for it. */
function scheduledOn(h: RawHabit, day: LocalDate, tz: string) {
  if (!h.days_of_week.includes(weekdayOf(day))) return false;
  if (localDate(new Date(h.created_at), tz) > day) return false;
  if (h.archived_at && localDate(new Date(h.archived_at), tz) <= day) return false;
  return true;
}

/**
 * Habit completion per day, 0 to 100, with partial credit for partial
 * progress (the 4-state ring). Null where nothing was scheduled. Today counts
 * only what's done so far.
 */
export function habitRateDaily(raw: InsightsRaw, days: LocalDate[], habitId?: string): (number | null)[] {
  const habits = raw.habits.filter((h) => !habitId || h.id === habitId);
  const progress = new Map(raw.habitLogs.map((l) => [`${l.habit_id}|${l.date}`, l.progress]));
  return days.map((d) => {
    const due = habits.filter((h) => scheduledOn(h, d, raw.tz));
    if (!due.length) return null;
    const got = sum(due.map((h) => Math.min(3, progress.get(`${h.id}|${d}`) ?? 0) / 3));
    return Math.round((got / due.length) * 100);
  });
}

function mean(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? Math.round(sum(v) / v.length) : null;
}

/** Longest run of completed scheduled days, from the habit's start to today. */
export function bestStreak(h: RawHabit, done: Set<LocalDate>, today: LocalDate, tz: string) {
  const start = localDate(new Date(h.created_at), tz);
  const span = Math.min(daysBetween(start, today), 3660);
  let best = 0;
  let run = 0;
  for (let i = 0; i <= span; i++) {
    const d = addDays(start, i);
    if (!h.days_of_week.includes(weekdayOf(d))) continue;
    if (done.has(d)) best = Math.max(best, ++run);
    else if (d !== today) run = 0;
  }
  return best;
}

export type HabitStat = {
  id: string;
  name: string;
  icon: string | null;
  streak: number;
  best: number;
  /** Completion over the window, 0 to 100, or null when nothing was scheduled. */
  rate: number | null;
  today: number;
  scheduledToday: boolean;
};

export function habitStats(raw: InsightsRaw, days: LocalDate[]): HabitStat[] {
  return raw.habits
    .filter((h) => !h.archived_at)
    .map((h) => {
      const mine = raw.habitLogs.filter((l) => l.habit_id === h.id);
      const done = new Set(mine.filter((l) => l.progress >= 3).map((l) => l.date));
      const today = mine.find((l) => l.date === raw.today)?.progress ?? 0;
      return {
        id: h.id,
        name: h.name,
        icon: h.icon,
        streak: currentStreak({ today: raw.today, startDate: localDate(new Date(h.created_at), raw.tz), daysOfWeek: h.days_of_week, doneDates: done }),
        best: bestStreak(h, done, raw.today, raw.tz),
        rate: mean(habitRateDaily(raw, days, h.id)),
        today,
        scheduledToday: h.days_of_week.includes(weekdayOf(raw.today)),
      };
    });
}

export type Slice = { label: string; value: number; emoji?: string | null };

/** Tasks completed in the window by project (top 6, the rest as Other), unfiled as Inbox. */
export function focusByProject(raw: InsightsRaw, days: LocalDate[]): Slice[] {
  const from = days[0];
  const counts = new Map<string, number>();
  for (const t of raw.tasks) {
    if (t.status !== "done" || !t.completed_at) continue;
    if (localDate(new Date(t.completed_at), raw.tz) < from) continue;
    const key = t.project_id ?? "";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const named = [...counts.entries()]
    .map(([id, value]) => {
      const p = raw.projects.find((x) => x.id === id);
      return { label: p?.name ?? "Inbox", value, emoji: p?.emoji ?? null };
    })
    .sort((a, b) => b.value - a.value);
  if (named.length <= 7) return named;
  return [...named.slice(0, 6), { label: "Other", value: sum(named.slice(6).map((s) => s.value)), emoji: null }];
}

/** Tasks completed in the window by area. */
export function focusByArea(raw: InsightsRaw, days: LocalDate[]): Slice[] {
  const from = days[0];
  const counts = new Map<string, number>();
  for (const t of raw.tasks) {
    if (t.status !== "done" || !t.completed_at) continue;
    if (localDate(new Date(t.completed_at), raw.tz) < from) continue;
    const area = raw.projects.find((p) => p.id === t.project_id)?.area_id ?? "";
    counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, value]) => {
      const a = raw.areas.find((x) => x.id === id);
      return { label: a?.name ?? "Unfiled", value, emoji: a?.emoji ?? null };
    })
    .sort((a, b) => b.value - a.value);
}

/** When tasks get done: a 7 x 24 grid (weekday x local hour) of completions. */
export function rhythm(raw: InsightsRaw, days: LocalDate[]): number[][] {
  const from = days[0];
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const t of raw.tasks) {
    if (t.status !== "done" || !t.completed_at) continue;
    const p = zonedParts(new Date(t.completed_at), raw.tz);
    if (p.date < from) continue;
    grid[p.weekday][Number(p.time.slice(0, 2))]++;
  }
  return grid;
}

export const hoursOf = (grid: number[][]) => Array.from({ length: 24 }, (_, h) => sum(grid.map((r) => r[h])));
export const weekdaysOf = (grid: number[][]) => grid.map(sum);

export type BotSeries = { id: string | null; name: string; color: string; values: number[]; total: number };

/** Actions per day by who did them: each bot (top 4, the rest as Other bots) and you. */
export function activityByActor(raw: InsightsRaw, days: LocalDate[]): BotSeries[] {
  const index = new Map(days.map((d, i) => [d, i]));
  const rows = new Map<string, number[]>();
  for (const a of raw.actions) {
    if (a.actor_kind === "system") continue;
    const i = index.get(localDate(new Date(a.created_at), raw.tz));
    if (i === undefined) continue;
    const key = a.actor_kind === "user" ? "you" : (a.bot_id ?? "bot");
    const r = rows.get(key) ?? days.map(() => 0);
    r[i]++;
    rows.set(key, r);
  }
  const all = [...rows.entries()].map(([key, values]) => {
    const bot = raw.bots.find((b) => b.id === key);
    return {
      id: key === "you" ? null : key,
      name: key === "you" ? "You" : (bot?.name ?? "A bot"),
      color: key === "you" ? "#141414" : (bot?.avatar_color ?? "#959595"),
      values,
      total: sum(values),
    };
  });
  const you = all.filter((s) => s.id === null);
  const bots = all.filter((s) => s.id !== null).sort((a, b) => b.total - a.total);
  if (bots.length <= 5) return [...bots, ...you];
  const rest = bots.slice(4);
  const other = { id: "other", name: "Other bots", color: "#b7b7b7", values: days.map((_, i) => sum(rest.map((s) => s.values[i]))), total: sum(rest.map((s) => s.total)) };
  return [...bots.slice(0, 4), other, ...you];
}

export function routineHealth(raw: InsightsRaw, days: LocalDate[]) {
  const from = days[0];
  const out = { ok: 0, error: 0, skipped: 0 };
  for (const r of raw.runs) {
    if (localDate(new Date(r.started_at), raw.tz) < from) continue;
    if (r.status === "ok" || r.status === "error" || r.status === "skipped") out[r.status]++;
  }
  return out;
}

/** Share of completed tasks with a due date that were done on or before it. */
export function onTimeRate(raw: InsightsRaw, days: LocalDate[]): number | null {
  const from = days[0];
  let due = 0;
  let onTime = 0;
  for (const t of raw.tasks) {
    if (t.status !== "done" || !t.completed_at || !t.due_date) continue;
    const doneOn = localDate(new Date(t.completed_at), raw.tz);
    if (doneOn < from) continue;
    due++;
    if (doneOn <= t.due_date) onTime++;
  }
  return due ? Math.round((onTime / due) * 100) : null;
}

export type Kpi = { value: number | null; previous: number | null };

export type Insights = {
  range: number;
  days: LocalDate[];
  kpis: { done: Kpi; habitRate: Kpi; captures: Kpi; botActions: Kpi; onTime: Kpi; bestStreak: number; open: number; overdue: number };
  done: number[];
  created: number[];
  habitRate: (number | null)[];
  captures: number[];
  habits: HabitStat[];
  projects: Slice[];
  areas: Slice[];
  rhythm: number[][];
  actors: BotSeries[];
  routines: { ok: number; error: number; skipped: number };
};

/** Everything the Insights page shows for one window (7, 30, 90 days...). */
export function buildInsights(raw: InsightsRaw, range: number): Insights {
  const days = dayRange(raw.today, range);
  const prev = dayRange(addDays(raw.today, -range), range);
  const done = tasksDoneDaily(raw, days);
  const habitRate = habitRateDaily(raw, days);
  const captures = capturesDaily(raw, days);
  const actors = activityByActor(raw, days);
  const prevActors = activityByActor(raw, prev);
  const habits = habitStats(raw, days);
  const botTotal = (s: BotSeries[]) => sum(s.filter((x) => x.id !== null).map((x) => x.total));
  const open = raw.tasks.filter((t) => t.status !== "done");
  return {
    range,
    days,
    kpis: {
      done: { value: sum(done), previous: sum(tasksDoneDaily(raw, prev)) },
      habitRate: { value: mean(habitRate), previous: mean(habitRateDaily(raw, prev)) },
      captures: { value: sum(captures), previous: sum(capturesDaily(raw, prev)) },
      botActions: { value: botTotal(actors), previous: botTotal(prevActors) },
      onTime: { value: onTimeRate(raw, days), previous: onTimeRate(raw, prev) },
      bestStreak: Math.max(0, ...habits.map((h) => h.streak)),
      open: open.length,
      overdue: open.filter((t) => t.due_date && t.due_date < raw.today).length,
    },
    done,
    created: tasksCreatedDaily(raw, days),
    habitRate,
    captures,
    habits,
    projects: focusByProject(raw, days),
    areas: focusByArea(raw, days),
    rhythm: rhythm(raw, days),
    actors,
    routines: routineHealth(raw, days),
  };
}

/** A short, plain-English read of a window: the line at the top of Insights. */
export function headline(i: Insights): string {
  const { done, habitRate } = i.kpis;
  const parts: string[] = [];
  if (done.value !== null && done.previous !== null && (done.value || done.previous)) {
    if (done.previous === 0) parts.push(`You finished ${done.value} task${done.value === 1 ? "" : "s"}`);
    else {
      const change = Math.round(((done.value - done.previous) / done.previous) * 100);
      parts.push(
        change === 0
          ? `You finished ${done.value} tasks, level with the period before`
          : `You finished ${done.value} tasks, ${Math.abs(change)}% ${change > 0 ? "more" : "fewer"} than the period before`,
      );
    }
  }
  if (habitRate.value !== null) parts.push(`kept ${habitRate.value}% of your habits`);
  const peak = hoursOf(i.rhythm);
  const best = peak.indexOf(Math.max(...peak));
  if (peak[best] > 2) parts.push(`did your best work around ${hourLabel(best)}`);
  if (!parts.length) return "Not much to read yet. Finish a few tasks and log some habits, and this page fills in.";
  const last = parts.pop()!;
  const text = `${parts.length ? `${parts.join(", ")} and ${last}` : last}.`;
  return text.startsWith("You") ? text : `You ${text}`;
}

export function hourLabel(h: number) {
  const hh = h % 12 || 12;
  return `${hh}${h < 12 ? "am" : "pm"}`;
}
