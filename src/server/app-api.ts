import "server-only";
import { must, type Ctx } from "./ctx";
import { completeTask, createTask, getTask, listTasks, reopenTask, type Task, type TaskScope } from "./tasks";
import { listHabits, logHabit, findHabit, type HabitWithStatus } from "./habits";
import { createCapture, listCaptures, markCaptureSeen, resurfacedCaptures, type CaptureWithCount } from "./captures";
import { listEvents } from "./google/calendar";
import { listAreas } from "./projects";
import { getProfile } from "./profile";
import { addDays, localDate } from "@/lib/time";
import { parseQuickAdd } from "@/lib/quick-add";
import {
  APP_API_VERSION,
  bucketByDay,
  type AppCapture,
  type AppEvent,
  type AppHabit,
  type AppMe,
  type AppSummary,
  type AppTask,
} from "@/lib/app-api";
import type { VerifiedToken } from "./tokens";

// The app API: what the iPhone app, its widgets and the Mac menu bar read and
// write. A thin layer over the same services the dashboard and MCP use, so
// every write is logged and revertible like any other. Shapes live in
// src/lib/app-api.ts.

const ACTIVITY_DAYS = 14;
const UPCOMING_DAYS = 7;

type ProjectNames = Map<string, string>;

async function projectNames(ctx: Ctx): Promise<ProjectNames> {
  const areas = await listAreas(ctx);
  return new Map([...areas.areas.flatMap((a) => a.projects), ...areas.unsorted].map((p) => [p.id, p.name]));
}

export function toAppTask(t: Task, today: string, projects: ProjectNames): AppTask {
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    status: t.status === "doing" || t.status === "done" ? t.status : "todo",
    priority: Math.max(0, Math.min(3, t.priority)),
    due_date: t.due_date,
    due_time: t.due_time ? t.due_time.slice(0, 5) : null,
    overdue: t.status !== "done" && !!t.due_date && t.due_date < today,
    project: t.project_id ? (projects.get(t.project_id) ?? null) : null,
    recurring: !!t.recurrence,
  };
}

function toAppHabit(h: HabitWithStatus): AppHabit {
  return {
    id: h.id,
    name: h.name,
    icon: h.icon,
    scheduled_today: h.scheduled_today,
    progress: h.today_progress,
    streak: h.streak,
    week: h.week,
  };
}

function toAppCapture(c: CaptureWithCount): AppCapture {
  return {
    id: c.id,
    content: c.content,
    source: c.source,
    created_at: c.created_at,
    replies: c.comment_count,
    resurfaced_at: c.resurfaced_at,
  };
}

async function calendarToday(ctx: Ctx, today: string): Promise<AppSummary["calendar"]> {
  const { data: accounts } = await ctx.db.from("google_accounts").select("id").eq("user_id", ctx.userId).limit(1);
  if (!accounts?.length) return { connected: false, error: null, events: [] };
  try {
    const now = ctx.now.toISOString();
    const events = await listEvents(ctx, { from: today, to: addDays(today, 1), limit: 20 });
    return {
      connected: true,
      error: null,
      events: events
        .filter((e) => e.all_day || e.end > now)
        .map(
          (e): AppEvent => ({
            id: e.id,
            title: e.title,
            start: e.start,
            end: e.end,
            all_day: e.all_day,
            location: e.location,
            color: e.color,
          }),
        ),
    };
  } catch (e) {
    return { connected: true, error: e instanceof Error ? e.message : String(e), events: [] };
  }
}

/** Completions (from the action log, so recurring tasks count) and finished habits per day. */
async function activity(ctx: Ctx, today: string) {
  const since = new Date(ctx.now.getTime() - (ACTIVITY_DAYS + 1) * 86_400_000).toISOString();
  const [done, habits] = await Promise.all([
    ctx.db
      .from("actions")
      .select("created_at")
      .eq("user_id", ctx.userId)
      .eq("tool", "complete_task")
      .is("reverted_at", null)
      .gte("created_at", since)
      .limit(2000),
    ctx.db
      .from("habit_logs")
      .select("date")
      .eq("user_id", ctx.userId)
      .eq("progress", 3)
      .gte("date", addDays(today, -ACTIVITY_DAYS + 1))
      .limit(2000),
  ]);
  const opts = { today, days: ACTIVITY_DAYS, toLocal: (iso: string) => localDate(new Date(iso), ctx.tz), addDays };
  const tasks = bucketByDay(
    must(done, "activity").map((a) => a.created_at),
    opts,
  );
  const habitCounts = new Map<string, number>();
  for (const l of must(habits, "habit activity")) habitCounts.set(l.date, (habitCounts.get(l.date) ?? 0) + 1);
  return tasks.map((d) => ({ date: d.date, tasks_done: d.count, habits_done: habitCounts.get(d.date) ?? 0 }));
}

/** Everything the app's home screen and every widget need, in one call. */
export async function appSummary(ctx: Ctx): Promise<AppSummary> {
  const today = localDate(ctx.now, ctx.tz);
  const [due, upcoming, inbox, habits, recent, resurfaced, calendar, days, projects, profile] = await Promise.all([
    listTasks(ctx, { scope: "today", limit: 100 }),
    listTasks(ctx, { scope: "upcoming", limit: 100 }),
    listTasks(ctx, { scope: "inbox", limit: 500 }),
    listHabits(ctx),
    listCaptures(ctx, { limit: 12 }),
    resurfacedCaptures(ctx),
    calendarToday(ctx, today),
    activity(ctx, today),
    projectNames(ctx),
    getProfile(ctx),
  ]);
  const horizon = addDays(today, UPCOMING_DAYS);
  const soon = upcoming.filter((t) => t.due_date && t.due_date <= horizon);
  const map = (t: Task) => toAppTask(t, today, projects);
  return {
    version: APP_API_VERSION,
    generated_at: ctx.now.toISOString(),
    timezone: ctx.tz,
    today,
    profile: { name: profile.display_name, avatar_url: profile.avatar_url },
    counts: {
      today_open: due.length,
      overdue: due.filter((t) => t.due_date && t.due_date < today).length,
      inbox: inbox.length,
      upcoming: soon.length,
      done_today: days.at(-1)?.tasks_done ?? 0,
      resurfaced: resurfaced.length,
    },
    tasks: { today: due.slice(0, 50).map(map), upcoming: soon.slice(0, 30).map(map) },
    habits: habits.map(toAppHabit),
    captures: { recent: recent.map(toAppCapture), resurfaced: resurfaced.slice(0, 10).map(toAppCapture) },
    calendar,
    activity: days,
  };
}

export async function appMe(ctx: Ctx, token: VerifiedToken): Promise<AppMe> {
  const profile = await getProfile(ctx);
  return {
    version: APP_API_VERSION,
    name: profile.display_name,
    avatar_url: profile.avatar_url,
    timezone: ctx.tz,
    token: { name: token.name, scope: token.scope },
  };
}

export async function appTasks(ctx: Ctx, scope: Exclude<TaskScope, "overdue" | "all">, limit = 100): Promise<AppTask[]> {
  const today = localDate(ctx.now, ctx.tz);
  const [tasks, projects] = await Promise.all([listTasks(ctx, { scope, limit }), projectNames(ctx)]);
  return tasks.map((t) => toAppTask(t, today, projects));
}

async function oneTask(ctx: Ctx, t: Task) {
  return toAppTask(t, localDate(ctx.now, ctx.tz), await projectNames(ctx));
}

export async function appCompleteTask(ctx: Ctx, id: string) {
  return oneTask(ctx, await completeTask(ctx, id));
}

export async function appReopenTask(ctx: Ctx, id: string) {
  await getTask(ctx, id);
  return oneTask(ctx, await reopenTask(ctx, id));
}

/** Quick add: dates, times, p1 to p4 and #Project come out of the text. */
export async function appCreateTask(ctx: Ctx, text: string) {
  const today = localDate(ctx.now, ctx.tz);
  const areas = await listAreas(ctx);
  const projects = [...areas.areas.flatMap((a) => a.projects), ...areas.unsorted].map((p) => ({ id: p.id, name: p.name }));
  const parsed = parseQuickAdd(text, { today, projects });
  const task = await createTask(ctx, {
    title: parsed.title || text.trim(),
    due_date: parsed.due_date ?? null,
    due_time: parsed.due_time ?? null,
    priority: parsed.priority,
    project: parsed.project_id ?? null,
  });
  return oneTask(ctx, task);
}

export async function appLogHabit(ctx: Ctx, id: string, progress?: number) {
  const habit = await findHabit(ctx, id);
  await logHabit(ctx, habit.id, { progress });
  const fresh = (await listHabits(ctx)).find((h) => h.id === habit.id);
  return fresh ? toAppHabit(fresh) : null;
}

export async function appCaptures(ctx: Ctx, limit = 30): Promise<AppCapture[]> {
  return (await listCaptures(ctx, { limit })).map(toAppCapture);
}

export async function appCreateCapture(ctx: Ctx, content: string): Promise<AppCapture> {
  const c = await createCapture(ctx, { content });
  return toAppCapture({ ...c, comment_count: 0 });
}

export async function appMarkCaptureSeen(ctx: Ctx, id: string) {
  await markCaptureSeen(ctx, id);
  return { id, seen: true };
}
