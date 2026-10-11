import { addDays, weekdayOf, type LocalDate } from "./time";

/**
 * Current streak for a habit: consecutive scheduled days completed (progress
 * 3), walking back from today. Unscheduled days are skipped, and an
 * unfinished today never breaks the streak. Stops at the habit's start date.
 */
export function currentStreak(opts: {
  today: LocalDate;
  startDate: LocalDate;
  daysOfWeek: number[];
  doneDates: Set<LocalDate>;
}): number {
  const { today, startDate, daysOfWeek, doneDates } = opts;
  if (!daysOfWeek.length) return 0;
  let streak = 0;
  let day = today;
  if (!doneDates.has(today)) day = addDays(today, -1);
  for (let guard = 0; guard < 3660 && day >= startDate; guard++, day = addDays(day, -1)) {
    if (!daysOfWeek.includes(weekdayOf(day))) continue;
    if (!doneDates.has(day)) break;
    streak++;
  }
  return streak;
}
