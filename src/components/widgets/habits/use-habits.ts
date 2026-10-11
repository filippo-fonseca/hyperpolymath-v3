"use client";

import { useCallback, useState } from "react";
import type { Habit } from "@/lib/dashboard-types";
import { logHabitAction } from "@/app/actions/habits";
import { useDashboard } from "@/components/dashboard/context";

/**
 * Habits with optimistic progress per (habit, date). An override holds until
 * the server value moves away from the value it was based on.
 */
export function useHabits() {
  const { data, run } = useDashboard();
  const [over, setOver] = useState<Record<string, { value: number; base: number }>>({});

  const serverProgress = useCallback(
    (h: Habit, date: string) =>
      date === data.today ? h.today_progress : (h.week.find((d) => d.date === date)?.progress ?? 0),
    [data.today],
  );

  const progressOn = useCallback(
    (h: Habit, date: string) => {
      const o = over[`${h.id}:${date}`];
      const server = serverProgress(h, date);
      return o && o.base === server ? o.value : server;
    },
    [over, serverProgress],
  );

  const cycle = useCallback(
    async (h: Habit, date = data.today) => {
      const k = `${h.id}:${date}`;
      const next = (progressOn(h, date) + 1) % 4;
      setOver((o) => ({ ...o, [k]: { value: next, base: serverProgress(h, date) } }));
      const res = await run(logHabitAction(h.id, next, date === data.today ? undefined : date));
      if (!res) {
        setOver((o) => {
          const n = { ...o };
          delete n[k];
          return n;
        });
      }
    },
    [data.today, progressOn, serverProgress, run],
  );

  const scheduled = data.habits.filter((h) => h.scheduled_today);
  return { habits: data.habits, scheduled, today: data.today, progressOn, cycle };
}
