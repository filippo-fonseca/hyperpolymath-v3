// Display formatting shared by client components. Pure: callers pass the
// current time and timezone so server and client renders agree.

import { addDays, daysBetween, weekdayOf, zonedParts, zonedToUtc, type LocalDate, type LocalTime } from "./time";

export function relativeTime(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return "never";
  const diff = nowMs - Date.parse(iso);
  const future = diff < 0;
  const s = Math.abs(diff) / 1000;
  let out: string;
  if (s < 45) return future ? "in a moment" : "just now";
  if (s < 3600) out = `${Math.round(s / 60)}m`;
  else if (s < 86400) out = `${Math.round(s / 3600)}h`;
  else if (s < 86400 * 7) out = `${Math.round(s / 86400)}d`;
  else if (s < 86400 * 60) out = `${Math.round(s / (86400 * 7))}w`;
  else out = `${Math.round(s / (86400 * 30))}mo`;
  return future ? `in ${out}` : `${out} ago`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function parts(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

/** "Mon, Oct 12" */
export function shortDate(date: string): string {
  const { m, d, wd } = parts(date);
  return `${WEEKDAYS_SHORT[wd]}, ${MONTHS[m - 1]} ${d}`;
}

/** "October 11" */
export function longDate(date: string): string {
  const { m, d } = parts(date);
  return `${MONTHS_LONG[m - 1]} ${d}`;
}

export function weekdayName(date: string): string {
  return WEEKDAYS_LONG[parts(date).wd];
}

export function dayOfMonth(date: string): number {
  return parts(date).d;
}

/** Human due label relative to today: "Today", "Tomorrow", "Yesterday", "3d overdue", "Fri", "Oct 30". */
export function dueLabel(due: string | null, today: string): string | null {
  if (!due) return null;
  const n = daysBetween(today, due);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n < 0) return `${-n}d overdue`;
  if (n < 7) return WEEKDAYS_SHORT[parts(due).wd];
  const { m, d, y } = parts(due);
  const ty = parts(today).y;
  return y === ty ? `${MONTHS[m - 1]} ${d}` : `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function timeLabel(t: string | null): string | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, "0")}${suffix}` : `${hh}${suffix}`;
}

/** Instant formatted in a timezone, e.g. "Mon 9:30am". */
export function instantLabel(iso: string | null, tz: string, today: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  const t = timeLabel(time);
  if (date === today) return `today ${t}`;
  if (date === addDays(today, 1)) return `tomorrow ${t}`;
  return `${shortDate(date)} ${t}`;
}

export const PRIORITY_LABELS = ["None", "Low", "Medium", "High"] as const;

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * A structured time a bot published (`at`): a date, or a date and time with
 * or without an offset. Read in the owner's timezone; no offset means their
 * wall clock.
 */
export type When = { instant: number; date: LocalDate; time: LocalTime | null };

export function parseWhen(at: string | null | undefined, tz: string): When | null {
  if (!at) return null;
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(at.trim());
  if (!m) return null;
  const [, date, hh, mm, offset] = m;
  if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return null;
  if (!hh) return { instant: zonedToUtc(date, "00:00", tz).getTime(), date, time: null };
  const instant = offset ? Date.parse(at.trim()) : zonedToUtc(date, `${hh}:${mm}`, tz).getTime();
  if (Number.isNaN(instant)) return null;
  const local = zonedParts(new Date(instant), tz);
  return { instant, date: local.date, time: local.time };
}

/**
 * "Today", "Tomorrow 9am", "Fri 4:30pm", "Mon, Dec 14", "Jan 9, 2027 11:20am".
 * `short` drops the weekday from far-off dates ("Dec 14 5pm"), for tight columns.
 */
export function whenLabel(w: When, today: string, short = false): string {
  const n = daysBetween(today, w.date);
  let day: string;
  if (n === 0) day = "Today";
  else if (n === 1) day = "Tomorrow";
  else if (n === -1) day = "Yesterday";
  else if (n > 1 && n < 7) day = WEEKDAYS_SHORT[parts(w.date).wd];
  else {
    const { y, m, d, wd } = parts(w.date);
    const md = `${MONTHS[m - 1]} ${d}`;
    day = y !== parts(today).y ? `${md}, ${y}` : short ? md : `${WEEKDAYS_SHORT[wd]}, ${md}`;
  }
  return w.time ? `${day} ${timeLabel(w.time)}` : day;
}

/** Past: a date before today, or a time already gone. */
export function whenIsPast(w: When, nowMs: number, today: string): boolean {
  return w.time ? w.instant < nowMs : w.date < today;
}

/** Within the next 24 hours (or today, for a bare date). */
export function whenIsSoon(w: When, nowMs: number, today: string): boolean {
  if (whenIsPast(w, nowMs, today)) return false;
  return w.time ? w.instant - nowMs <= 86_400_000 : w.date === today;
}

/**
 * A widget's structured `at` (ISO datetime or YYYY-MM-DD) in the owner's
 * timezone: relative when close ("in 20m", "2h ago"), else a day and time
 * ("today 3:30pm", "Fri 9am", "Nov 28").
 */
export function formatAt(at: string, tz: string, nowMs: number): string {
  const w = parseWhen(at, tz);
  if (!w) return at;
  const today = zonedParts(new Date(nowMs), tz).date;
  const diffDays = daysBetween(today, w.date);
  const dayWord =
    diffDays === 0 ? "today" : diffDays === 1 ? "tomorrow" : diffDays === -1 ? "yesterday" : Math.abs(diffDays) < 7 ? WEEKDAYS_SHORT[weekdayOf(w.date)] : `${MONTHS[Number(w.date.slice(5, 7)) - 1]} ${Number(w.date.slice(8, 10))}`;
  if (!w.time) return dayWord === "today" ? "Today" : dayWord === "tomorrow" ? "Tomorrow" : dayWord === "yesterday" ? "Yesterday" : dayWord;
  const mins = (w.instant - nowMs) / 60_000;
  if (Math.abs(mins) < 1) return "now";
  if (Math.abs(mins) < 90) return mins > 0 ? `in ${Math.round(mins)}m` : `${Math.round(-mins)}m ago`;
  return `${dayWord} ${timeLabel(w.time)}`;
}
