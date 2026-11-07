import { firstFire, scheduleSchema, type Schedule } from "./schedule";
import { addDays, daysBetween, localDate, weekdayOf, zonedParts, zonedToUtc } from "./time";
import { WEEKDAYS_LONG, instantLabel, shortDate, timeLabel } from "./format";

// The resurface picker's model: what you chose in the UI, turned into a
// schedule (+ optional start) for the server, and described in plain words.
// Client-safe and pure.

export type Repeat = "never" | "daily" | "weekdays" | "every";
export type ResurfaceChoice = { date: string; time: string; repeat: Repeat; everyDays: number };

export const EVERY_DAYS_MIN = 2;
export const EVERY_DAYS_MAX = 7; // interval schedules top out at a week
const WEEKDAYS = [1, 2, 3, 4, 5];
const MORNING = "09:00";

export type QuickPick = { id: string; label: string; date: string; time: string };

/** One-tap choices, computed in your timezone. "Later today" only while there's room in the day. */
export function quickPicks(now: Date, tz: string): QuickPick[] {
  const { date: today, time } = zonedParts(now, tz);
  const picks: QuickPick[] = [];
  const hour = Number(time.slice(0, 2)) + 3 + (time.slice(3) === "00" ? 0 : 1);
  if (hour <= 21) picks.push({ id: "later", label: "Later today", date: today, time: `${String(hour).padStart(2, "0")}:00` });
  picks.push({ id: "tomorrow", label: "Tomorrow", date: addDays(today, 1), time: MORNING });
  const wd = weekdayOf(today);
  picks.push({ id: "weekend", label: "This weekend", date: addDays(today, wd === 6 ? 7 : 6 - wd), time: MORNING });
  picks.push({ id: "week", label: "Next week", date: addDays(today, ((8 - wd) % 7) || 7), time: MORNING });
  picks.push({ id: "month", label: "In a month", date: addDays(today, 30), time: MORNING });
  return picks;
}

/** The schedule and start the server takes for a choice. */
export function buildResurface(c: ResurfaceChoice, tz: string): { schedule: Schedule; startAt: string | null } {
  const start = zonedToUtc(c.date, c.time, tz).toISOString();
  switch (c.repeat) {
    case "never":
      return { schedule: { type: "once", date: c.date, time: c.time }, startAt: null };
    case "daily":
      return { schedule: { type: "daily", times: [c.time] }, startAt: start };
    case "weekdays":
      return { schedule: { type: "daily", times: [c.time], days: WEEKDAYS }, startAt: start };
    case "every": {
      const n = Math.min(EVERY_DAYS_MAX, Math.max(EVERY_DAYS_MIN, Math.round(c.everyDays)));
      return { schedule: { type: "interval", every_minutes: n * 24 * 60 }, startAt: start };
    }
  }
}

/** When a choice first brings the capture back, or null if that's in the past. Mirrors the server. */
export function firstReturn(c: ResurfaceChoice, now: Date, tz: string): Date | null {
  const { schedule, startAt } = buildResurface(c, tz);
  const start = startAt ? new Date(startAt) : null;
  if (start && start <= now) return null;
  if (schedule.type === "interval") return start;
  return firstFire(schedule, start ?? now, tz);
}

/** "today", "tomorrow", "on Friday", "on Mon, Nov 30". */
function dayWords(date: string, today: string): string {
  const n = daysBetween(today, date);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n > 1 && n < 7) return `on ${WEEKDAYS_LONG[weekdayOf(date)]}`;
  return `on ${shortDate(date)}`;
}

function repeatWords(c: ResurfaceChoice): string | null {
  if (c.repeat === "daily") return "every day";
  if (c.repeat === "weekdays") return "every weekday";
  if (c.repeat === "every") return `every ${Math.min(EVERY_DAYS_MAX, Math.max(EVERY_DAYS_MIN, Math.round(c.everyDays)))} days`;
  return null;
}

/** Plain-language summary for the picker, e.g. "Comes back every weekday at 9am, starting Monday." */
export function summarize(c: ResurfaceChoice, now: Date, tz: string): string {
  const first = firstReturn(c, now, tz);
  if (!first) return "That time has already passed. Pick a later one.";
  const today = localDate(now, tz);
  const { date, time } = zonedParts(first, tz);
  const at = timeLabel(time);
  const repeat = repeatWords(c);
  if (!repeat) return `Comes back ${dayWords(date, today)} at ${at}.`;
  const from = dayWords(date, today).replace(/^on /, "");
  return `Comes back ${repeat} at ${at}, starting ${from}.`;
}

/** The picker's starting state: the capture's current schedule, or tomorrow morning. */
export function choiceFor(
  capture: { resurface_schedule: unknown; resurface_next_at: string | null } | null,
  now: Date,
  tz: string,
): ResurfaceChoice {
  const fallback: ResurfaceChoice = { date: addDays(localDate(now, tz), 1), time: MORNING, repeat: "never", everyDays: 3 };
  const parsed = scheduleSchema.safeParse(capture?.resurface_schedule);
  if (!capture || !parsed.success) return fallback;
  const s = parsed.data;
  const next = capture.resurface_next_at ? zonedParts(new Date(capture.resurface_next_at), tz) : null;
  const date = next?.date ?? fallback.date;
  if (s.type === "once") return { ...fallback, date: s.date, time: s.time };
  if (s.type === "daily") {
    const weekdays = s.days?.length === 5 && WEEKDAYS.every((d) => s.days!.includes(d));
    return { ...fallback, date, time: s.times[0], repeat: weekdays ? "weekdays" : "daily" };
  }
  const days = Math.min(EVERY_DAYS_MAX, Math.max(EVERY_DAYS_MIN, Math.round(s.every_minutes / 1440)));
  return { ...fallback, date, time: next?.time ?? MORNING, repeat: "every", everyDays: days };
}

/** Short label for a scheduled capture: "Back tomorrow 9am", with "· daily" etc. when it repeats. */
export function resurfaceBadge(
  capture: { resurface_schedule: unknown; resurface_next_at: string | null },
  tz: string,
  today: string,
): string | null {
  if (!capture.resurface_next_at) return null;
  const when = instantLabel(capture.resurface_next_at, tz, today);
  const s = scheduleSchema.safeParse(capture.resurface_schedule);
  let repeat = "";
  if (s.success && s.data.type === "daily") repeat = s.data.days?.length === 5 ? " · weekdays" : " · daily";
  if (s.success && s.data.type === "interval") repeat = ` · every ${Math.round(s.data.every_minutes / 1440)} days`;
  return `Back ${when}${repeat}`;
}
