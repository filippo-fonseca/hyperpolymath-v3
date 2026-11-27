// The contract between the server and the native apps (iPhone, widgets, Mac
// menu bar). Everything under /api/v1 answers in these shapes, and the Swift
// models in apple/HyperpolymathKit decode exactly these fields. A shared JSON
// fixture (apple/HyperpolymathKit/Tests/HyperpolymathKitTests/Fixtures) is
// checked against these schemas here and decoded by the Swift tests, so the
// two sides can't drift quietly. Bump APP_API_VERSION on a breaking change.

import { z } from "zod";

export const APP_API_VERSION = 1;

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const appTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string().nullable(),
  status: z.enum(["todo", "doing", "done"]),
  /** 0 (none) to 3 (P1). */
  priority: z.number().int().min(0).max(3),
  due_date: localDate.nullable(),
  /** "HH:MM", 24h. */
  due_time: z.string().nullable(),
  overdue: z.boolean(),
  project: z.string().nullable(),
  recurring: z.boolean(),
});

export const appHabitDaySchema = z.object({
  date: localDate,
  progress: z.number().int().min(0).max(3),
  scheduled: z.boolean(),
});

export const appHabitSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  scheduled_today: z.boolean(),
  /** 0 none, 1 started, 2 almost, 3 done. */
  progress: z.number().int().min(0).max(3),
  streak: z.number().int().min(0),
  /** This calendar week, Sunday first. */
  week: z.array(appHabitDaySchema),
});

export const appCaptureSchema = z.object({
  id: z.string(),
  content: z.string(),
  source: z.string(),
  created_at: z.string(),
  replies: z.number().int().min(0),
  resurfaced_at: z.string().nullable(),
});

export const appEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** ISO instant, or YYYY-MM-DD when all_day. */
  start: z.string(),
  end: z.string(),
  all_day: z.boolean(),
  location: z.string().nullable(),
  color: z.string().nullable(),
});

export const appActivityDaySchema = z.object({
  date: localDate,
  tasks_done: z.number().int().min(0),
  habits_done: z.number().int().min(0),
});

export const appSummarySchema = z.object({
  version: z.literal(APP_API_VERSION),
  generated_at: z.string(),
  timezone: z.string(),
  today: localDate,
  profile: z.object({ name: z.string().nullable(), avatar_url: z.string().nullable() }),
  counts: z.object({
    today_open: z.number().int().min(0),
    overdue: z.number().int().min(0),
    inbox: z.number().int().min(0),
    upcoming: z.number().int().min(0),
    done_today: z.number().int().min(0),
    resurfaced: z.number().int().min(0),
  }),
  tasks: z.object({
    /** Open tasks due today or overdue, most urgent first. */
    today: z.array(appTaskSchema),
    /** Open tasks in the next 7 days. */
    upcoming: z.array(appTaskSchema),
  }),
  habits: z.array(appHabitSchema),
  captures: z.object({ recent: z.array(appCaptureSchema), resurfaced: z.array(appCaptureSchema) }),
  calendar: z.object({ connected: z.boolean(), error: z.string().nullable(), events: z.array(appEventSchema) }),
  /** The last 14 days, oldest first, ending today. */
  activity: z.array(appActivityDaySchema),
});

export const appMeSchema = z.object({
  version: z.literal(APP_API_VERSION),
  name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  timezone: z.string(),
  token: z.object({ name: z.string(), scope: z.enum(["full", "app"]) }),
});

export type AppTask = z.infer<typeof appTaskSchema>;
export type AppHabit = z.infer<typeof appHabitSchema>;
export type AppCapture = z.infer<typeof appCaptureSchema>;
export type AppEvent = z.infer<typeof appEventSchema>;
export type AppActivityDay = z.infer<typeof appActivityDaySchema>;
export type AppSummary = z.infer<typeof appSummarySchema>;
export type AppMe = z.infer<typeof appMeSchema>;

// Request bodies.

export const appCreateTaskSchema = z.object({
  /** Quick-add text: "Call the bank tomorrow 5pm p1 #Admin". */
  text: z.string().trim().min(1).max(500),
});

export const appLogHabitSchema = z.object({
  /** Defaults to done (3). */
  progress: z.number().int().min(0).max(3).optional(),
});

export const appCreateCaptureSchema = z.object({
  content: z.string().trim().min(1).max(20000),
});

export const appTaskScopeSchema = z.enum(["today", "upcoming", "inbox", "open", "done"]);

/**
 * Count instants per local day over the `days` days ending `today`, oldest
 * first. Days with nothing get 0, so a chart always has a full row.
 */
export function bucketByDay(
  instants: string[],
  opts: { today: string; days: number; toLocal: (iso: string) => string; addDays: (d: string, n: number) => string },
): { date: string; count: number }[] {
  const out = Array.from({ length: opts.days }, (_, i) => ({ date: opts.addDays(opts.today, i - opts.days + 1), count: 0 }));
  const index = new Map(out.map((d, i) => [d.date, i]));
  for (const iso of instants) {
    const i = index.get(opts.toLocal(iso));
    if (i !== undefined) out[i].count++;
  }
  return out;
}
