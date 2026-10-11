import "server-only";
import { AppError, type Ctx, type Row } from "../ctx";
import { logAction } from "../log";
import { accessToken, listAccounts, type GoogleAccount } from "./oauth";
import { addDays, isLocalDate, localDate, zonedParts, zonedToUtc } from "@/lib/time";

// Google Calendar, read live (Google stays the source of truth) and written
// through here so every bot edit is logged and revertible.

const API = "https://www.googleapis.com/calendar/v3";

type GEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  updated?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
};

export type CalendarEvent = {
  id: string; // opaque: account/calendar/event
  title: string;
  when: string; // human, local: "2026-10-11 14:00-15:00" or "2026-10-11 (all day)"
  start: string; // ISO instant, or YYYY-MM-DD for all-day
  end: string;
  all_day: boolean;
  location: string | null;
  description: string | null;
  calendar: string;
  account: string;
  link: string | null;
  color: string | null;
  updated: string | null;
  /** Set for Hyperpolymath tasks with a due time shown on the agenda. */
  task_id?: string;
};

export type CalendarInfo = {
  account_id: string;
  account: string;
  id: string;
  name: string;
  primary: boolean;
  shown: boolean;
  is_default: boolean;
  color: string | null;
};

const encodeId = (accountId: string, calendarId: string, eventId: string) =>
  `${accountId}/${encodeURIComponent(calendarId)}/${eventId}`;

function decodeId(id: string) {
  const [accountId, cal, eventId] = id.split("/");
  if (!accountId || !cal || !eventId) throw new AppError("Unknown event id. Use list_events to get ids.");
  return { accountId, calendarId: decodeURIComponent(cal), eventId };
}

async function gfetch<T>(ctx: Ctx, account: GoogleAccount, path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken(ctx.db, account);
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;
    throw new AppError(`Google Calendar: ${msg}`, res.status === 404 ? "not_found" : "invalid");
  }
  return body as T;
}

async function accountById(ctx: Ctx, id: string) {
  const acct = (await listAccounts(ctx.db, ctx.userId)).find((a) => a.id === id);
  if (!acct) throw new AppError("That calendar account isn't connected anymore.", "not_found");
  return acct;
}

function shownCalendars(a: GoogleAccount) {
  return a.calendar_ids.length ? a.calendar_ids : ["primary"];
}

function normalize(ctx: Ctx, a: GoogleAccount, calendarId: string, e: GEvent, calName?: string, color?: string | null): CalendarEvent {
  const allDay = !!e.start.date;
  let when: string;
  if (allDay) {
    const last = addDays(e.end.date!, -1);
    when = last === e.start.date ? `${e.start.date} (all day)` : `${e.start.date} to ${last} (all day)`;
  } else {
    const s = zonedParts(new Date(e.start.dateTime!), ctx.tz);
    const en = zonedParts(new Date(e.end.dateTime!), ctx.tz);
    when = s.date === en.date ? `${s.date} ${s.time}-${en.time}` : `${s.date} ${s.time} to ${en.date} ${en.time}`;
  }
  return {
    id: encodeId(a.id, calendarId, e.id),
    title: e.summary ?? "(no title)",
    when,
    start: e.start.date ?? e.start.dateTime!,
    end: e.end.date ?? e.end.dateTime!,
    all_day: allDay,
    location: e.location ?? null,
    description: e.description ? e.description.slice(0, 2000) : null,
    calendar: calName ?? calendarId,
    account: a.email,
    link: e.htmlLink ?? null,
    color: color ?? null,
    updated: e.updated ?? null,
  };
}

export async function listCalendars(ctx: Ctx): Promise<CalendarInfo[]> {
  const accounts = await listAccounts(ctx.db, ctx.userId);
  const out: CalendarInfo[] = [];
  await Promise.all(
    accounts.map(async (a) => {
      const res = await gfetch<{ items: { id: string; summary: string; primary?: boolean; backgroundColor?: string }[] }>(
        ctx,
        a,
        "/users/me/calendarList?minAccessRole=reader",
      );
      const shown = shownCalendars(a);
      for (const c of res.items ?? []) {
        out.push({
          account_id: a.id,
          account: a.email,
          id: c.id,
          name: c.summary,
          primary: !!c.primary,
          shown: shown.includes(c.id) || (!!c.primary && shown.includes("primary")),
          is_default: a.default_calendar_id === c.id || (!!c.primary && a.default_calendar_id === "primary"),
          color: c.backgroundColor ?? null,
        });
      }
    }),
  );
  return out;
}

/** Events across every shown calendar, between two local dates (inclusive). */
export async function listEvents(
  ctx: Ctx,
  opts: { from?: string; to?: string; query?: string; limit?: number } = {},
): Promise<CalendarEvent[]> {
  const today = localDate(ctx.now, ctx.tz);
  const from = opts.from && isLocalDate(opts.from) ? opts.from : today;
  const to = opts.to && isLocalDate(opts.to) ? opts.to : addDays(from, 6);
  const timeMin = zonedToUtc(from, "00:00", ctx.tz).toISOString();
  const timeMax = zonedToUtc(addDays(to, 1), "00:00", ctx.tz).toISOString();
  const accounts = await listAccounts(ctx.db, ctx.userId);
  const events: CalendarEvent[] = [];
  const errors: string[] = [];
  await Promise.all(
    accounts.flatMap((a) =>
      shownCalendars(a).map(async (cal) => {
        const params = new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "250",
        });
        if (opts.query) params.set("q", opts.query);
        try {
          const res = await gfetch<{ summary?: string; items: GEvent[] }>(
            ctx,
            a,
            `/calendars/${encodeURIComponent(cal)}/events?${params}`,
          );
          for (const e of res.items ?? []) {
            if (e.status === "cancelled") continue;
            events.push(normalize(ctx, a, cal, e, res.summary));
          }
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e));
        }
      }),
    ),
  );
  if (!events.length && errors.length) throw new AppError(errors[0]);
  events.sort((x, y) => sortKey(x, ctx.tz).localeCompare(sortKey(y, ctx.tz)));
  return events.slice(0, opts.limit ?? 200);
}

function sortKey(e: CalendarEvent, tz: string) {
  // All-day events sort first on their day.
  if (e.all_day) return `${e.start} 00:00:0`;
  const p = zonedParts(new Date(e.start), tz);
  return `${p.date} ${p.time}:1`;
}

export type EventInput = {
  title?: string;
  date?: string; // YYYY-MM-DD
  start_time?: string | null; // HH:MM local; omit or null for all-day
  end_time?: string | null;
  duration_minutes?: number;
  end_date?: string; // multi-day all-day
  location?: string | null;
  description?: string | null;
};

function toGoogleTimes(ctx: Ctx, input: EventInput) {
  if (!input.date) throw new AppError("date is required (YYYY-MM-DD).");
  if (!input.start_time) {
    const last = input.end_date ?? input.date;
    return { start: { date: input.date }, end: { date: addDays(last, 1) } };
  }
  const start = zonedToUtc(input.date, input.start_time, ctx.tz);
  let end: Date;
  if (input.end_time) {
    end = zonedToUtc(input.end_date ?? input.date, input.end_time, ctx.tz);
    if (end <= start) end = new Date(end.getTime() + 86_400_000);
  } else {
    end = new Date(start.getTime() + (input.duration_minutes ?? 60) * 60_000);
  }
  return {
    start: { dateTime: start.toISOString(), timeZone: ctx.tz },
    end: { dateTime: end.toISOString(), timeZone: ctx.tz },
  };
}

/** Resolve a target calendar from an account email, calendar id/name, or the default. */
async function targetCalendar(ctx: Ctx, calendar?: string) {
  const accounts = await listAccounts(ctx.db, ctx.userId);
  if (!accounts.length) throw new AppError("No Google Calendar connected. Connect one in Settings.", "not_found");
  if (!calendar) return { account: accounts[0], calendarId: accounts[0].default_calendar_id };
  const byEmail = accounts.find((a) => a.email === calendar.toLowerCase());
  if (byEmail) return { account: byEmail, calendarId: byEmail.default_calendar_id };
  const cals = await listCalendars(ctx);
  const c = cals.find((x) => x.id === calendar || x.name.toLowerCase() === calendar.toLowerCase());
  if (!c) throw new AppError(`No calendar "${calendar}". Use list_calendars.`, "not_found");
  return { account: accounts.find((a) => a.id === c.account_id)!, calendarId: c.id };
}

type Snapshot = { account_id: string; calendar_id: string; event: Pick<GEvent, "summary" | "description" | "location" | "start" | "end" | "updated"> & { id: string } };

const snap = (accountId: string, calendarId: string, e: GEvent): Snapshot => ({
  account_id: accountId,
  calendar_id: calendarId,
  event: { id: e.id, summary: e.summary, description: e.description, location: e.location, start: e.start, end: e.end, updated: e.updated },
});

export async function createEvent(ctx: Ctx, input: EventInput & { title: string; calendar?: string }) {
  const { account, calendarId } = await targetCalendar(ctx, input.calendar);
  const body = {
    summary: input.title,
    location: input.location ?? undefined,
    description: input.description ?? undefined,
    ...toGoogleTimes(ctx, input),
  };
  const e = await gfetch<GEvent>(ctx, account, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const ev = normalize(ctx, account, calendarId, e);
  await logAction(ctx, {
    tool: "create_event",
    entityType: "event",
    entityId: ev.id,
    before: null,
    after: snap(account.id, calendarId, e),
    summary: `Added "${ev.title}" to the calendar (${ev.when})`,
  });
  return ev;
}

async function getRaw(ctx: Ctx, id: string) {
  const { accountId, calendarId, eventId } = decodeId(id);
  const account = await accountById(ctx, accountId);
  const e = await gfetch<GEvent>(ctx, account, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
  return { account, calendarId, eventId, e };
}

export async function updateEvent(ctx: Ctx, id: string, input: EventInput) {
  const { account, calendarId, eventId, e: before } = await getRaw(ctx, id);
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.summary = input.title;
  if (input.location !== undefined) patch.location = input.location;
  if (input.description !== undefined) patch.description = input.description;
  if (input.date || input.start_time !== undefined || input.end_time || input.duration_minutes) {
    // Fill unspecified parts from the current event.
    const curAllDay = !!before.start.date;
    const curStart = curAllDay ? null : zonedParts(new Date(before.start.dateTime!), ctx.tz);
    const curMinutes = curAllDay
      ? 60
      : Math.round((Date.parse(before.end.dateTime!) - Date.parse(before.start.dateTime!)) / 60_000);
    Object.assign(
      patch,
      toGoogleTimes(ctx, {
        date: input.date ?? curStart?.date ?? before.start.date,
        start_time: input.start_time === undefined ? (curStart?.time ?? null) : input.start_time,
        end_time: input.end_time,
        duration_minutes: input.duration_minutes ?? curMinutes,
        end_date: input.end_date,
      }),
    );
  }
  const after = await gfetch<GEvent>(ctx, account, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  const ev = normalize(ctx, account, calendarId, after);
  await logAction(ctx, {
    tool: "update_event",
    entityType: "event",
    entityId: id,
    before: snap(account.id, calendarId, before),
    after: snap(account.id, calendarId, after),
    summary: `Updated "${ev.title}" (${ev.when})`,
  });
  return ev;
}

export async function deleteEvent(ctx: Ctx, id: string) {
  const { account, calendarId, eventId, e } = await getRaw(ctx, id);
  await gfetch(ctx, account, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
  });
  await logAction(ctx, {
    tool: "delete_event",
    entityType: "event",
    entityId: id,
    before: snap(account.id, calendarId, e),
    after: null,
    summary: `Removed "${e.summary ?? "event"}" from the calendar`,
  });
  return { deleted: e.summary ?? "event" };
}

/** Undo a calendar action (called by revertAction). */
export async function revertEventAction(ctx: Ctx, action: Row<"actions">, force: boolean) {
  const before = action.before as Snapshot | null;
  const after = action.after as Snapshot | null;
  const { accountId, calendarId, eventId } = decodeId(action.entity_id!);
  const account = await accountById(ctx, accountId);
  const path = `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  if (!before) {
    await gfetch(ctx, account, path, { method: "DELETE" }).catch((e) => {
      if (!(e instanceof AppError && e.code === "not_found")) throw e;
    });
    return { restored: null, current: after, entityId: action.entity_id };
  }
  const fields = {
    summary: before.event.summary,
    description: before.event.description,
    location: before.event.location,
    start: before.event.start,
    end: before.event.end,
  };
  if (!after) {
    const e = await gfetch<GEvent>(ctx, account, `/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: "POST",
      body: JSON.stringify(fields),
    });
    // Re-created events get a new Google id; log under it so a later undo finds it.
    return { restored: snap(account.id, calendarId, e), current: null, entityId: encodeId(account.id, calendarId, e.id) };
  }
  const current = await gfetch<GEvent>(ctx, account, path);
  if (!force && after.event.updated && current.updated && current.updated !== after.event.updated) {
    throw new AppError("This event changed after that action. Revert anyway with force.", "conflict");
  }
  const e = await gfetch<GEvent>(ctx, account, path, { method: "PATCH", body: JSON.stringify(fields) });
  return { restored: snap(account.id, calendarId, e), current: snap(account.id, calendarId, current), entityId: action.entity_id };
}

/** Today's remaining and upcoming events, compact, for the overview. */
export async function upcomingForOverview(ctx: Ctx) {
  const accounts = await listAccounts(ctx.db, ctx.userId);
  if (!accounts.length) return { connected: false as const, events: [] };
  try {
    const today = localDate(ctx.now, ctx.tz);
    const events = await listEvents(ctx, { from: today, to: addDays(today, 1), limit: 30 });
    const now = ctx.now.toISOString();
    return {
      connected: true as const,
      events: events
        .filter((e) => e.all_day || e.end > now)
        .map((e) => ({ id: e.id, title: e.title, when: e.when, location: e.location })),
    };
  } catch (e) {
    return { connected: true as const, error: e instanceof Error ? e.message : String(e), events: [] };
  }
}
