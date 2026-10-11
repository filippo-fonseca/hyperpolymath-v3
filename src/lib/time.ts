// Timezone helpers built on Intl only (no date library). Dates are local
// calendar strings ("2026-10-11"), times are "HH:MM", instants are Date.

export type LocalDate = string; // YYYY-MM-DD
export type LocalTime = string; // HH:MM

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    partsCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Wall-clock parts of an instant in a timezone. */
export function zonedParts(instant: Date, tz: string) {
  const p = Object.fromEntries(
    formatter(tz)
      .formatToParts(instant)
      .map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}` as LocalDate,
    time: `${p.hour}:${p.minute}` as LocalTime,
    seconds: Number(p.second),
    weekday: WEEKDAYS.indexOf(p.weekday),
  };
}

export function localDate(instant: Date, tz: string): LocalDate {
  return zonedParts(instant, tz).date;
}

/** Offset (ms) of tz from UTC at a given instant. */
function offsetAt(instant: Date, tz: string) {
  const { date, time, seconds } = zonedParts(instant, tz);
  const asUtc = Date.parse(`${date}T${time}:${String(seconds).padStart(2, "0")}Z`);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant at which the wall clock in tz reads `date time`. */
export function zonedToUtc(date: LocalDate, time: LocalTime, tz: string): Date {
  const naive = Date.parse(`${date}T${time}:00Z`);
  // Two passes settle DST transitions.
  let guess = naive - offsetAt(new Date(naive), tz);
  guess = naive - offsetAt(new Date(guess), tz);
  return new Date(guess);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(date: LocalDate): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function isLocalTime(s: string): s is LocalTime {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function isLocalDate(s: string): s is LocalDate {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}
