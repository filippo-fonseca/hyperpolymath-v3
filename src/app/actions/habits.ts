"use server";

import { z } from "zod";
import { createHabit, logHabit, updateHabit } from "@/server/habits";
import { asUser } from "./run";

const id = z.string().uuid();
const days = z.array(z.number().int().min(0).max(6)).min(1).max(7);

export async function logHabitAction(habitId: string, progress: number, date?: string) {
  return asUser((ctx) =>
    logHabit(ctx, id.parse(habitId), {
      progress: z.number().int().min(0).max(3).parse(progress),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().parse(date),
    }),
  );
}

export async function createHabitAction(input: { name: string; days_of_week: number[]; area?: string | null }) {
  return asUser((ctx) =>
    createHabit(ctx, {
      name: z.string().max(120).parse(input.name),
      days_of_week: days.parse(input.days_of_week),
      area: id.nullable().optional().parse(input.area),
    }),
  );
}

export async function updateHabitAction(
  habitId: string,
  patch: { name?: string; days_of_week?: number[]; archived?: boolean; area?: string | null },
) {
  return asUser((ctx) => {
    const p = z
      .object({ name: z.string().min(1).max(120), days_of_week: days, archived: z.boolean(), area: id.nullable() })
      .partial()
      .parse(patch);
    return updateHabit(ctx, id.parse(habitId), p);
  });
}
