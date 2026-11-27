import "server-only";
import type { Ctx } from "./ctx";
import { listTasks } from "./tasks";
import { listHabits } from "./habits";
import { listCaptures, resurfacedCaptures } from "./captures";
import { describeResurface } from "@/lib/resurface";
import { listReminders } from "./reminders";
import { listWidgets } from "./widgets";
import { upcomingForOverview } from "./google/calendar";
import { listAreas } from "./projects";
import { localDate, zonedParts } from "@/lib/time";

/**
 * One call that grounds a bot in the current state of things. Compact on
 * purpose: ids and the fields a bot needs to act, nothing else. Times are
 * local to the owner, and default-valued fields are omitted.
 */
export async function getOverview(ctx: Ctx) {
  const [today, inbox, habits, captures, resurfaced, reminders, widgets, calendar, areas] = await Promise.all([
    listTasks(ctx, { scope: "today", limit: 50 }),
    listTasks(ctx, { scope: "inbox", limit: 20 }),
    listHabits(ctx),
    listCaptures(ctx, { limit: 8 }),
    resurfacedCaptures(ctx),
    listReminders(ctx),
    listWidgets(ctx),
    upcomingForOverview(ctx),
    listAreas(ctx),
  ]);
  return shapeOverview({ today, inbox, habits, captures, resurfaced, reminders, widgets, calendar, areas }, ctx);
}

export type OverviewInput = {
  today: Awaited<ReturnType<typeof listTasks>>;
  inbox: Awaited<ReturnType<typeof listTasks>>;
  habits: Awaited<ReturnType<typeof listHabits>>;
  captures: Awaited<ReturnType<typeof listCaptures>>;
  resurfaced: Awaited<ReturnType<typeof resurfacedCaptures>>;
  reminders: Awaited<ReturnType<typeof listReminders>>;
  widgets: Awaited<ReturnType<typeof listWidgets>>;
  calendar: Awaited<ReturnType<typeof upcomingForOverview>>;
  areas: Awaited<ReturnType<typeof listAreas>>;
};

/** First 200 characters, marking the cut so a bot knows to fetch the rest. */
const clip = (s: string) => (s.length > 200 ? s.slice(0, 199) + "…" : s);

/** Pure shaping step, so the payload size can be tested without a database. */
export function shapeOverview(
  { today, inbox, habits, captures, resurfaced, reminders, widgets, calendar, areas }: OverviewInput,
  ctx: Pick<Ctx, "now" | "tz">,
) {
  const projectName = new Map(
    [...areas.areas.flatMap((a) => a.projects), ...areas.unsorted].map((p) => [p.id, p.name]),
  );
  const date = localDate(ctx.now, ctx.tz);
  const now = zonedParts(ctx.now, ctx.tz);
  // Local "YYYY-MM-DD HH:MM", the same clock as `now`, and far shorter than ISO.
  const at = (iso: string | null | undefined) => {
    if (!iso) return null;
    const p = zonedParts(new Date(iso), ctx.tz);
    return `${p.date} ${p.time}`;
  };
  // Defaults are left out (status todo, priority 0, not overdue, not recurring).
  const task = (t: (typeof today)[number]) => ({
    id: t.id,
    title: t.title,
    status: t.status === "todo" ? undefined : t.status,
    priority: t.priority || undefined,
    due: t.due_date ? `${t.due_date}${t.due_time ? " " + t.due_time.slice(0, 5) : ""}` : null,
    overdue: (!!t.due_date && t.due_date < date) || undefined,
    project: t.project_id ? (projectName.get(t.project_id) ?? null) : null,
    recurring: !!t.recurrence || undefined,
  });
  return {
    now: `${now.date} ${now.time}`,
    timezone: ctx.tz,
    calendar_today_and_tomorrow: calendar,
    areas_and_active_projects: areas.areas.map((a) => ({
      area: `${a.emoji ? a.emoji + " " : ""}${a.name}`,
      projects: a.projects
        .filter((p) => p.status === "active")
        .map((p) => ({ name: p.name, open_tasks: p.open_tasks })), // tools take project names
    })),
    tasks_due_today_or_overdue: today.map(task),
    inbox_tasks_without_date: inbox.map(task),
    habits_today: habits
      .filter((h) => h.scheduled_today)
      .map((h) => ({ name: h.name, progress: `${h.today_progress}/3`, streak: h.streak })),
    recent_captures: captures.map((c) => ({
      id: c.id,
      content: clip(c.content),
      source: c.source,
      at: at(c.created_at),
      replies: c.comment_count || undefined,
    })),
    resurfaced_captures: resurfaced.map((c) => ({
      id: c.id,
      content: clip(c.content),
      resurfaced_at: at(c.resurfaced_at),
      schedule: c.resurface_schedule ? describeResurface(c.resurface_schedule) : null,
      replies: c.comment_count || undefined,
    })),
    active_reminders: reminders.map((r) => ({
      id: r.id,
      for: r.task?.title ?? r.message,
      next_fire_at: at(r.next_fire_at),
      until: r.until_kind,
    })),
    widgets: widgets.map((w) => ({
      title: w.title,
      kind: w.kind,
      owner: w.owner?.name ?? null,
      published_at: at(w.published_at),
    })),
  };
}
