import type { CalendarEvent } from "@/lib/dashboard-types";
import { timeLabel } from "@/lib/format";

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
