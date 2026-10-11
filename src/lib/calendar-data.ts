import "server-only";
import type { Ctx } from "@/server/ctx";
import { listEvents } from "@/server/google/calendar";
import { googleConfigured, listAccounts } from "@/server/google/oauth";
import { addDays, localDate } from "@/lib/time";
import type { CalendarData } from "@/lib/dashboard-types";

/**
 * This week's agenda for the calendar widget. Never throws: Google errors
 * come back as `error` so they render inline instead of breaking the page.
 */
export async function loadCalendar(ctx: Ctx): Promise<CalendarData> {
  const from = localDate(ctx.now, ctx.tz);
  const to = addDays(from, 6);
  const configured = googleConfigured();
  try {
    const accounts = await listAccounts(ctx.db, ctx.userId);
    const safeAccounts = accounts.map((a) => ({
      id: a.id,
      email: a.email,
      calendar_ids: a.calendar_ids,
      default_calendar_id: a.default_calendar_id,
    }));
    if (!accounts.length) return { configured, accounts: [], events: [], error: null, from, to };
    try {
      const events = await listEvents(ctx, { from, to, limit: 200 });
      return { configured, accounts: safeAccounts, events, error: null, from, to };
    } catch (e) {
      return { configured, accounts: safeAccounts, events: [], error: message(e), from, to };
    }
  } catch (e) {
    return { configured, accounts: [], events: [], error: message(e), from, to };
  }
}

function message(e: unknown) {
  return e instanceof Error ? e.message : "Couldn't load your calendar.";
}
