// Display formatting shared by client components. Pure: callers pass the
// current time and timezone so server and client renders agree.

import { addDays, daysBetween } from "./time";

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
