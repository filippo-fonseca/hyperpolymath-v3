import { z } from "zod";
import { addDays, isLocalDate, isLocalTime, zonedParts, zonedToUtc, weekdayOf } from "./time";

// Reminder schedules. Kept small and explicit so a model can emit them
// reliably from plain English ("every 3 hours between 9 and 10pm").

const time = z.string().refine(isLocalTime, "expected HH:MM (24h)");
const date = z.string().refine(isLocalDate, "expected YYYY-MM-DD");
const weekdays = z.array(z.number().int().min(0).max(6)).min(1).describe("0 = Sunday ... 6 = Saturday");

export const scheduleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("once"),
    date,
    time,
  }),
  z.object({
    type: z.literal("daily"),
    times: z.array(time).min(1).max(12),
    days: weekdays.optional(),
  }),
  z.object({
    type: z.literal("interval"),
    every_minutes: z.number().int().min(5).max(7 * 24 * 60),
    window: z.object({ start: time, end: time }).optional(),
    days: weekdays.optional(),
  }),
]);

export type Schedule = z.infer<typeof scheduleSchema>;

const SEARCH_DAYS = 9;

/**
 * Next instant strictly after `after` at which the schedule fires, or null if
 * it never fires again.
 */
export function nextFire(schedule: Schedule, after: Date, tz: string): Date | null {
  switch (schedule.type) {
    case "once": {
      const at = zonedToUtc(schedule.date, schedule.time, tz);
      return at > after ? at : null;
    }
    case "daily": {
      const times = [...schedule.times].sort();
      let day = zonedParts(after, tz).date;
      for (let i = 0; i < SEARCH_DAYS; i++, day = addDays(day, 1)) {
        if (schedule.days && !schedule.days.includes(weekdayOf(day))) continue;
        for (const t of times) {
          const at = zonedToUtc(day, t, tz);
          if (at > after) return at;
        }
      }
      return null;
    }
    case "interval": {
      const candidate = new Date(after.getTime() + schedule.every_minutes * 60_000);
      const start = schedule.window?.start ?? "00:00";
      const end = schedule.window?.end ?? "23:59";
      const overnight = end <= start; // e.g. 22:00 to 02:00 runs into the next day
      // Start a day early: an overnight window that began yesterday may still be open.
      let day = addDays(zonedParts(candidate, tz).date, -1);
      for (let i = 0; i < SEARCH_DAYS + 1; i++, day = addDays(day, 1)) {
        if (schedule.days && !schedule.days.includes(weekdayOf(day))) continue;
        const ws = zonedToUtc(day, start, tz);
        const we = zonedToUtc(overnight ? addDays(day, 1) : day, end, tz);
        if (candidate <= we) return candidate < ws ? ws : candidate;
      }
      return null;
    }
  }
}

/** First fire for a newly created reminder: the first slot at or after now. */
export function firstFire(schedule: Schedule, now: Date, tz: string): Date | null {
  if (schedule.type === "interval") {
    // Start the cadence now if inside the window, otherwise at the next window.
    const back = new Date(now.getTime() - schedule.every_minutes * 60_000);
    return nextFire(schedule, back, tz);
  }
  return nextFire(schedule, new Date(now.getTime() - 1), tz);
}

export function describeSchedule(s: Schedule): string {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = (d?: number[]) =>
    !d || d.length === 7 ? "every day" : d.map((x) => dayNames[x]).join(", ");
  switch (s.type) {
    case "once":
      return `once on ${s.date} at ${s.time}`;
    case "daily":
      return `${days(s.days)} at ${s.times.join(", ")}`;
    case "interval": {
      const m = s.every_minutes;
      const every = m % 60 === 0 ? `${m / 60}h` : `${m}m`;
      const win = s.window ? ` between ${s.window.start} and ${s.window.end}` : "";
      return `every ${every}${win}, ${days(s.days)}`;
    }
  }
}
