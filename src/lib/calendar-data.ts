import "server-only";
import type { Ctx } from "@/server/ctx";
import { listEvents, type CalendarEvent } from "@/server/google/calendar";
import { listTasks } from "@/server/tasks";
import { listAreas } from "@/server/projects";
import { indexProjects, taskCalendarLabel } from "@/lib/projects";
import { googleConfigured, listAccounts } from "@/server/google/oauth";
import { addDays, localDate, zonedToUtc } from "@/lib/time";
import type { CalendarData } from "@/lib/dashboard-types";

/**
 * This week's agenda for the calendar widget. Never throws: Google errors
 * come back as `error` so they render inline instead of breaking the page.
 */
export async function loadCalendar(ctx: Ctx): Promise<CalendarData> {
  const from = localDate(ctx.now, ctx.tz);
  const to = addDays(from, 6);
  const [google, tasks] = await Promise.all([loadGoogle(ctx, from, to), timedTasks(ctx, from, to)]);
  const events = [...google.events, ...tasks].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  return { ...google, events, from, to };
}

async function loadGoogle(ctx: Ctx, from: string, to: string): Promise<Omit<CalendarData, "from" | "to">> {
  const configured = googleConfigured();
  try {
    const accounts = await listAccounts(ctx.db, ctx.userId);
    const safeAccounts = accounts.map((a) => ({
      id: a.id,
      email: a.email,
      calendar_ids: a.calendar_ids,
      default_calendar_id: a.default_calendar_id,
      enabled: a.enabled,
      is_default: a.is_default,
    }));
    if (!accounts.length) return { configured, accounts: [], events: [], error: null };
    try {
      const events = await listEvents(ctx, { from, to, limit: 200 });
      return { configured, accounts: safeAccounts, events, error: null };
    } catch (e) {
      return { configured, accounts: safeAccounts, events: [], error: message(e) };
    }
  } catch (e) {
    return { configured, accounts: [], events: [], error: message(e) };
  }
}

/** Open tasks due this week at a set time, shown on the agenda as 30-minute slots. */
async function timedTasks(ctx: Ctx, from: string, to: string): Promise<CalendarEvent[]> {
  try {
    const [tasks, areas] = await Promise.all([listTasks(ctx, { scope: "open", limit: 300 }), listAreas(ctx, { includeArchived: true })]);
    const projects = indexProjects(areas);
    return tasks
      .filter((t) => t.due_date && t.due_time && t.due_date >= from && t.due_date <= to)
      .map((t) => {
        const start = zonedToUtc(t.due_date!, t.due_time!.slice(0, 5), ctx.tz);
        return {
          id: `task:${t.id}`,
          task_id: t.id,
          title: t.title,
          when: `${t.due_date} ${t.due_time!.slice(0, 5)}`,
          start: start.toISOString(),
          end: new Date(start.getTime() + 30 * 60_000).toISOString(),
          all_day: false,
          location: null,
          description: null,
          calendar: taskCalendarLabel(t.project_id ? projects.get(t.project_id)?.project.name : null),
          account: "",
          link: null,
          color: "var(--ink)",
          updated: t.updated_at,
        };
      });
  } catch {
    return [];
  }
}

const sortKey = (e: CalendarEvent) => (e.all_day ? `${e.start.slice(0, 10)}T00:00:00.000Z#0` : `${e.start}#1`);

function message(e: unknown) {
  return e instanceof Error ? e.message : "Couldn't load your calendar.";
}
