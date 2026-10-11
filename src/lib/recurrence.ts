import { z } from "zod";
import { addDays, weekdayOf, type LocalDate } from "./time";

// Task recurrence: one live row per series. Completing it moves due_date to
// the next occurrence instead of creating a new row.

export const recurrenceSchema = z.object({
  freq: z.enum(["daily", "weekly", "monthly"]),
  interval: z.number().int().min(1).max(365).default(1),
  days: z
    .array(z.number().int().min(0).max(6))
    .min(1)
    .optional()
    .describe("weekly only: weekdays, 0 = Sunday"),
  month_day: z
    .number()
    .int()
    .min(1)
    .max(31)
    .optional()
    .describe("monthly only: day of month to aim for (defaults to the due date's day); short months clamp"),
});

export type Recurrence = z.infer<typeof recurrenceSchema>;

/** Next due date strictly after `from` (the current due date, or today). */
export function nextOccurrence(rule: Recurrence, from: LocalDate): LocalDate {
  const interval = rule.interval ?? 1;
  switch (rule.freq) {
    case "daily":
      return addDays(from, interval);
    case "weekly": {
      if (!rule.days?.length) return addDays(from, 7 * interval);
      const days = [...rule.days].sort();
      const wd = weekdayOf(from);
      const later = days.find((d) => d > wd);
      if (later !== undefined) return addDays(from, later - wd);
      // Wrap to the first listed weekday, `interval` weeks after this week.
      return addDays(from, 7 * interval - wd + days[0]);
    }
    case "monthly": {
      const [y, m, fromDay] = from.split("-").map(Number);
      const d = rule.month_day ?? fromDay;
      const target = new Date(Date.UTC(y, m - 1 + interval, 1));
      const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      target.setUTCDate(Math.min(d, lastDay));
      return target.toISOString().slice(0, 10);
    }
  }
}
