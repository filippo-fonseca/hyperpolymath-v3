import type { CalendarEvent, Task } from "@/lib/dashboard-types";
import { timeLabel } from "@/lib/format";
import { addDays, weekdayOf, zonedToUtc } from "@/lib/time";

const dateFmt = new Map<string, Intl.DateTimeFormat>();
const timeFmt = new Map<string, Intl.DateTimeFormat>();

function fmt(map: Map<string, Intl.DateTimeFormat>, tz: string, opts: Intl.DateTimeFormatOptions, locale: string) {
  let f = map.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone: tz, ...opts });
    map.set(tz, f);
  }
  return f;
}

/** Local calendar date an event starts on. */
export function eventDate(e: CalendarEvent, tz: string): string {
  if (e.all_day) return e.start.slice(0, 10);
  return fmt(dateFmt, tz, { year: "numeric", month: "2-digit", day: "2-digit" }, "en-CA").format(new Date(e.start));
}

export function eventTime(iso: string, tz: string): string {
  const hhmm = fmt(timeFmt, tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, "en-GB").format(new Date(iso));
  return timeLabel(hhmm) ?? "";
}

export function durationLabel(e: CalendarEvent): string {
  if (e.all_day) return "All day";
  const m = Math.round((Date.parse(e.end) - Date.parse(e.start)) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

export function isNow(e: CalendarEvent, nowMs: number) {
  return !e.all_day && Date.parse(e.start) <= nowMs && nowMs < Date.parse(e.end);
}

/** Events still relevant today: all-day ones, ongoing, and upcoming. */
export function remainingToday(events: CalendarEvent[], today: string, tz: string, nowMs: number) {
  return events.filter((e) => eventDate(e, tz) === today && (e.all_day || Date.parse(e.end) > nowMs));
}

export function groupByDay(events: CalendarEvent[], tz: string) {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const d = eventDate(e, tz);
    map.set(d, [...(map.get(d) ?? []), e]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/** Quick-add prefill: a date, and a start time or all-day. */
export type Draft = { date: string; time?: string; allDay?: boolean };

/* ---------- ranges ---------- */

/** Sunday on or before `date` (weeks start on Sunday, like the weekday pickers). */
export function weekStart(date: string): string {
  return addDays(date, -weekdayOf(date));
}

export function firstOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** First of the month `n` months away from `date`'s month. */
export function addMonths(date: string, n: number): string {
  const [y, m] = date.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

/** First day of the 6-week grid that shows `date`'s month. */
export function monthGridStart(date: string): string {
  return weekStart(firstOfMonth(date));
}

/** "October 2026" */
export function monthLabel(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** First and last local dates an event touches (all-day ends are exclusive). */
export function eventSpan(e: CalendarEvent, tz: string): { first: string; last: string } {
  if (e.all_day) {
    const first = e.start.slice(0, 10);
    const end = e.end.slice(0, 10);
    return { first, last: end > first ? addDays(end, -1) : first };
  }
  const first = eventDate(e, tz);
  const endMs = Math.max(Date.parse(e.end) - 1, Date.parse(e.start));
  const last = fmt(dateFmt, tz, { year: "numeric", month: "2-digit", day: "2-digit" }, "en-CA").format(new Date(endMs));
  return { first, last };
}

export function overlapsRange(e: CalendarEvent, from: string, to: string, tz: string) {
  const { first, last } = eventSpan(e, tz);
  return first <= to && last >= from;
}

/** Open tasks due in the range at a set time, as 30-minute agenda slots. */
export function timedTaskEvents(tasks: Task[], from: string, to: string, tz: string): CalendarEvent[] {
  return tasks
    .filter((t) => t.status !== "done" && t.due_date && t.due_time && t.due_date >= from && t.due_date <= to)
    .map((t) => {
      const start = zonedToUtc(t.due_date!, t.due_time!.slice(0, 5), tz);
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
        calendar: t.list ? `Task · ${t.list}` : "Task",
        account: "",
        link: null,
        color: "var(--ink)",
        updated: t.updated_at,
      };
    });
}

/* ---------- time grid ---------- */

/** Minutes since local midnight for an instant. */
export function minutesInDay(iso: string, tz: string): number {
  const hhmm = fmt(timeFmt, tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, "en-GB").format(new Date(iso));
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export type Segment = { e: CalendarEvent; start: number; end: number };

/** The part of each timed event that falls on `day`, in minutes from midnight. */
export function daySegments(events: CalendarEvent[], day: string, tz: string): Segment[] {
  const out: Segment[] = [];
  for (const e of events) {
    if (e.all_day) continue;
    const { first, last } = eventSpan(e, tz);
    if (day < first || day > last) continue;
    const start = day === first ? minutesInDay(e.start, tz) : 0;
    const endDay = eventDate({ ...e, start: e.end }, tz);
    const end = day === endDay ? minutesInDay(e.end, tz) : 24 * 60;
    out.push({ e, start, end: Math.max(end, start) });
  }
  return out;
}

/** All-day events that cover `day`. */
export function allDayOn(events: CalendarEvent[], day: string, tz: string): CalendarEvent[] {
  return events.filter((e) => {
    if (!e.all_day) return false;
    const { first, last } = eventSpan(e, tz);
    return first <= day && day <= last;
  });
}

export type Placed = Segment & { col: number; cols: number };

/**
 * Side-by-side layout for overlapping events. Events that overlap (directly
 * or through a chain) form a cluster; each gets the first free column and
 * every member shares the cluster's column count. `minSpan` is the shortest
 * visual length in minutes, so tiny events that would draw on top of each
 * other still get their own column.
 */
export function layoutDay(segments: Segment[], minSpan = 0): Placed[] {
  const sorted = [...segments].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    for (const p of cluster) p.cols = colEnds.length;
    cluster = [];
    colEnds = [];
    clusterEnd = -Infinity;
  };
  for (const s of sorted) {
    const end = Math.max(s.end, s.start + minSpan);
    if (cluster.length && s.start >= clusterEnd) flush();
    let col = colEnds.findIndex((e) => e <= s.start);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(end);
    } else colEnds[col] = end;
    const p: Placed = { ...s, col, cols: 1 };
    cluster.push(p);
    out.push(p);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return out;
}
