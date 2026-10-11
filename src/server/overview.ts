import "server-only";
import type { Ctx } from "./ctx";
import { listTasks } from "./tasks";
import { listHabits } from "./habits";
import { listCaptures, resurfacingCaptures } from "./captures";
import { listReminders } from "./reminders";
import { listWidgets } from "./widgets";
import { upcomingForOverview } from "./google/calendar";
import { listAreas } from "./projects";
import { localDate, zonedParts } from "@/lib/time";

/**
 * One call that grounds a bot in the current state of things. Compact on
 * purpose: ids and the fields a bot needs to act, nothing else.
 */
export async function getOverview(ctx: Ctx) {
  const [today, inbox, habits, captures, resurfacing, reminders, widgets, calendar, areas] = await Promise.all([
    listTasks(ctx, { scope: "today", limit: 50 }),
    listTasks(ctx, { scope: "inbox", limit: 20 }),
    listHabits(ctx),
    listCaptures(ctx, { limit: 8 }),
    resurfacingCaptures(ctx),
    listReminders(ctx),
    listWidgets(ctx),
    upcomingForOverview(ctx),
    listAreas(ctx),
  ]);
  const projectName = new Map(
    [...areas.areas.flatMap((a) => a.projects), ...areas.unsorted].map((p) => [p.id, p.name]),
  );
  const date = localDate(ctx.now, ctx.tz);
  const now = zonedParts(ctx.now, ctx.tz);
  const task = (t: (typeof today)[number]) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    due: t.due_date ? `${t.due_date}${t.due_time ? " " + t.due_time.slice(0, 5) : ""}` : null,
    overdue: !!t.due_date && t.due_date < date,
    project: t.project_id ? (projectName.get(t.project_id) ?? null) : null,
    recurring: !!t.recurrence,
  });
  return {
    now: `${now.date} ${now.time}`,
    timezone: ctx.tz,
    calendar_today_and_tomorrow: calendar,
    areas_and_active_projects: areas.areas.map((a) => ({
      area: `${a.emoji ? a.emoji + " " : ""}${a.name}`,
      projects: a.projects
        .filter((p) => p.status === "active")
        .map((p) => ({ id: p.id, name: p.name, open_tasks: p.open_tasks })),
    })),
    tasks_due_today_or_overdue: today.map(task),
    inbox_tasks_without_date: inbox.map(task),
    habits_today: habits
      .filter((h) => h.scheduled_today)
      .map((h) => ({ name: h.name, progress: `${h.today_progress}/3`, streak: h.streak })),
    recent_captures: captures.map((c) => ({ id: c.id, content: c.content.slice(0, 200), source: c.source, at: c.created_at })),
    resurfacing_captures: resurfacing.map((c) => ({ id: c.id, content: c.content.slice(0, 200) })),
    active_reminders: reminders.map((r) => ({
      id: r.id,
      for: r.task?.title ?? r.message,
      next_fire_at: r.next_fire_at,
      until: r.until_kind,
    })),
    widgets: widgets.map((w) => ({
      title: w.title,
      kind: w.kind,
      owner: w.owner?.name ?? null,
      published_at: w.published_at,
    })),
  };
}
