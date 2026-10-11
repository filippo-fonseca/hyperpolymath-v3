import "server-only";
import { AppError, must, type Ctx, type Row, type Update, escapeLike } from "./ctx";
import { logAction } from "./log";
import { currentStreak } from "@/lib/streak";
import { addDays, localDate, weekdayOf } from "@/lib/time";

export type Habit = Row<"habits">;
export type HabitWithStatus = Habit & {
  scheduled_today: boolean;
  today_progress: number;
  streak: number;
  week: { date: string; progress: number; scheduled: boolean }[];
};

const STREAK_WINDOW_DAYS = 400;

export async function findHabit(ctx: Ctx, idOrName: string): Promise<Habit> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrName);
  const q = ctx.db.from("habits").select().eq("user_id", ctx.userId).is("archived_at", null);
  const { data } = isUuid ? await q.eq("id", idOrName).maybeSingle() : await q.ilike("name", escapeLike(idOrName)).maybeSingle();
  if (!data) throw new AppError(`No habit "${idOrName}". Use list_habits to see names.`, "not_found");
  return data;
}

export async function listHabits(ctx: Ctx): Promise<HabitWithStatus[]> {
  const today = localDate(ctx.now, ctx.tz);
  const habits = must(
    await ctx.db.from("habits").select().eq("user_id", ctx.userId).is("archived_at", null).order("position"),
    "list habits",
  );
  if (!habits.length) return [];
  const logs = must(
    await ctx.db
      .from("habit_logs")
      .select("habit_id, date, progress")
      .eq("user_id", ctx.userId)
      .gte("date", addDays(today, -STREAK_WINDOW_DAYS)),
    "habit logs",
  );
  const weekStart = addDays(today, -weekdayOf(today));
  return habits.map((h) => {
    const mine = logs.filter((l) => l.habit_id === h.id);
    const byDate = new Map(mine.map((l) => [l.date, l.progress]));
    const done = new Set(mine.filter((l) => l.progress >= 3).map((l) => l.date));
    return {
      ...h,
      scheduled_today: h.days_of_week.includes(weekdayOf(today)),
      today_progress: byDate.get(today) ?? 0,
      streak: currentStreak({
        today,
        startDate: localDate(new Date(h.created_at), ctx.tz),
        daysOfWeek: h.days_of_week,
        doneDates: done,
      }),
      week: Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        return { date, progress: byDate.get(date) ?? 0, scheduled: h.days_of_week.includes(i) };
      }),
    };
  });
}

export async function createHabit(ctx: Ctx, input: { name: string; icon?: string | null; days_of_week?: number[] }) {
  const name = input.name.trim();
  if (!name) throw new AppError("Habit name can't be empty.");
  const habit = must(
    await ctx.db
      .from("habits")
      .insert({
        user_id: ctx.userId,
        name,
        icon: input.icon ?? null,
        days_of_week: input.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
        position: ctx.now.getTime(),
      })
      .select()
      .single(),
    "create habit",
  );
  await logAction(ctx, {
    tool: "create_habit",
    entityType: "habit",
    entityId: habit.id,
    before: null,
    after: habit,
    summary: `Created habit "${name}"`,
  });
  return habit;
}

export async function updateHabit(
  ctx: Ctx,
  idOrName: string,
  patch: { name?: string; icon?: string | null; days_of_week?: number[]; archived?: boolean },
) {
  const before = await findHabit(ctx, idOrName);
  const values: Update<"habits"> = {};
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.icon !== undefined) values.icon = patch.icon;
  if (patch.days_of_week !== undefined) values.days_of_week = patch.days_of_week;
  if (patch.archived !== undefined) values.archived_at = patch.archived ? ctx.now.toISOString() : null;
  const after = must(await ctx.db.from("habits").update(values).eq("id", before.id).select().single(), "update habit");
  await logAction(ctx, {
    tool: "update_habit",
    entityType: "habit",
    entityId: before.id,
    before,
    after,
    summary: patch.archived ? `Archived habit "${before.name}"` : `Updated habit "${after.name}"`,
  });
  return after;
}

/** Set a day's progress (0 to 3, 3 = done). Defaults to today, done. */
export async function logHabit(ctx: Ctx, idOrName: string, opts: { date?: string; progress?: number } = {}) {
  const habit = await findHabit(ctx, idOrName);
  const date = opts.date ?? localDate(ctx.now, ctx.tz);
  const progress = Math.max(0, Math.min(3, Math.round(opts.progress ?? 3)));
  const { data: before } = await ctx.db
    .from("habit_logs")
    .select()
    .eq("habit_id", habit.id)
    .eq("date", date)
    .maybeSingle();
  const after = must(
    await ctx.db
      .from("habit_logs")
      .upsert({ user_id: ctx.userId, habit_id: habit.id, date, progress }, { onConflict: "habit_id,date" })
      .select()
      .single(),
    "log habit",
  );
  const label = ["cleared", "started", "almost done", "done"][progress];
  await logAction(ctx, {
    tool: "log_habit",
    entityType: "habit_log",
    entityId: after.id,
    before,
    after,
    summary: `Marked "${habit.name}" ${label} for ${date}`,
  });
  return { habit: habit.name, date, progress };
}
