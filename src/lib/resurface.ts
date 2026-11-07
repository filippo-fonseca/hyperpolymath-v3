import { describeSchedule, nextFire, scheduleSchema } from "./schedule";

// Bringing captures back on a schedule. Pure helpers shared by the tick and
// the capture service.

/**
 * A capture that just came back: mark it resurfaced now and step its schedule
 * to the next slot after now (null when it never comes back again, e.g. once).
 * Steps from the scheduled slot so missed slots are skipped, not replayed.
 */
export function advanceResurface(schedule: unknown, nextAt: string | null, now: Date, tz: string) {
  const s = scheduleSchema.safeParse(schedule);
  let next: Date | null = null;
  if (s.success && s.data.type !== "once") {
    let base = nextAt ? new Date(nextAt) : now;
    if (base > now) base = now;
    next = nextFire(s.data, base, tz);
    for (let i = 0; next && next <= now && i < 1000; i++) next = nextFire(s.data, next, tz);
  }
  return { resurfaced_at: now.toISOString(), resurface_next_at: next?.toISOString() ?? null };
}

/** A short excerpt for the Kiwi nudge: whitespace collapsed, cut at a word. */
export function excerpt(content: string, max = 280): string {
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** "every day at 09:00", or "custom" for a schedule that doesn't parse. */
export function describeResurface(schedule: unknown): string {
  const s = scheduleSchema.safeParse(schedule);
  return s.success ? describeSchedule(s.data) : "custom";
}
