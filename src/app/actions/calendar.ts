"use server";

import { z } from "zod";
import { createEvent, deleteEvent, listCalendars, listEvents } from "@/server/google/calendar";
import { disconnectAccount, setCalendars, setDefaultTarget } from "@/server/google/oauth";
import { asUser, readAsUser } from "./run";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}$/);

export async function listEventsAction(from: string, to: string) {
  return readAsUser((ctx) => listEvents(ctx, { from: date.parse(from), to: date.parse(to), limit: 300 }));
}

export async function createEventAction(input: {
  title: string;
  date: string;
  start_time?: string | null;
  duration_minutes?: number;
  calendar?: string;
}) {
  return asUser((ctx) => {
    const v = z
      .object({
        title: z.string().trim().min(1).max(300),
        date,
        start_time: time.nullable().optional(),
        duration_minutes: z.number().int().min(5).max(24 * 60).optional(),
        calendar: z.string().max(300).optional(),
      })
      .parse(input);
    return createEvent(ctx, v);
  });
}

export async function deleteEventAction(eventId: string) {
  return asUser((ctx) => deleteEvent(ctx, z.string().min(3).max(1000).parse(eventId)));
}

export async function listCalendarsAction() {
  return readAsUser((ctx) => listCalendars(ctx));
}

export async function setCalendarsAction(
  accountId: string,
  patch: { calendar_ids?: string[]; default_calendar_id?: string; enabled?: boolean },
) {
  return asUser(async (ctx) => {
    const p = z
      .object({
        calendar_ids: z.array(z.string().max(300)).max(100),
        default_calendar_id: z.string().max(300),
        enabled: z.boolean(),
      })
      .partial()
      .parse(patch);
    await setCalendars(ctx.db, ctx.userId, z.string().uuid().parse(accountId), p);
    return true;
  });
}

export async function disconnectGoogleAction(accountId: string) {
  return asUser(async (ctx) => {
    await disconnectAccount(ctx.db, ctx.userId, z.string().uuid().parse(accountId));
    return true;
  });
}

export async function setDefaultCalendarAction(accountId: string, calendarId: string) {
  return asUser(async (ctx) => {
    await setDefaultTarget(ctx.db, ctx.userId, z.string().uuid().parse(accountId), z.string().min(1).max(300).parse(calendarId));
    return true;
  });
}
