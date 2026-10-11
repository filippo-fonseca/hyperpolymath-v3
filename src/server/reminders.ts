import "server-only";
import { AppError, asJson, must, type Ctx, type Row } from "./ctx";
import { logAction } from "./log";
import { getTask } from "./tasks";
import { describeSchedule, firstFire, nextFire, scheduleSchema, type Schedule } from "@/lib/schedule";
import { localDate } from "@/lib/time";

export type Reminder = Row<"reminders">;

export type ReminderInput = {
  task_id?: string | null;
  message?: string | null;
  schedule: Schedule;
  until?: "done" | "date" | "count" | "once";
  until_date?: string | null;
  count?: number | null;
};

export async function listReminders(ctx: Ctx, opts: { taskId?: string; includeInactive?: boolean } = {}) {
  let q = ctx.db
    .from("reminders")
    .select("*, task:tasks(id, title, status)")
    .eq("user_id", ctx.userId)
    .order("next_fire_at", { ascending: true, nullsFirst: false });
  if (!opts.includeInactive) q = q.eq("active", true);
  if (opts.taskId) q = q.eq("task_id", opts.taskId);
  return must(await q, "list reminders");
}

export async function setReminder(ctx: Ctx, input: ReminderInput) {
  const schedule = scheduleSchema.parse(input.schedule);
  let label = input.message?.trim() || null;
  if (input.task_id) label = label ?? (await getTask(ctx, input.task_id)).title;
  if (!label) throw new AppError("A reminder needs a task_id or a message.");
  let until = input.until ?? (input.task_id ? "done" : "once");
  if (until === "done" && !input.task_id) until = "once";
  if (until === "date" && !input.until_date) throw new AppError("until=date needs until_date.");
  if (until === "count" && !input.count) throw new AppError("until=count needs count.");

  const next = firstFire(schedule, ctx.now, ctx.tz);
  if (!next) throw new AppError("That schedule never fires (is the time in the past?).");
  const reminder = must(
    await ctx.db
      .from("reminders")
      .insert({
        user_id: ctx.userId,
        task_id: input.task_id ?? null,
        message: input.message?.trim() || null,
        schedule: asJson(schedule),
        until_kind: until,
        until_date: input.until_date ?? null,
        remaining_count: until === "count" ? input.count! : null,
        next_fire_at: next.toISOString(),
        created_by: ctx.actor.name,
      })
      .select()
      .single(),
    "create reminder",
  );
  await logAction(ctx, {
    tool: "set_reminder",
    entityType: "reminder",
    entityId: reminder.id,
    before: null,
    after: reminder,
    summary: `Reminder for "${label}": ${describeSchedule(schedule)}${until === "done" ? " until done" : ""}`,
  });
  return { ...reminder, describes: describeSchedule(schedule), first_fire_at: next.toISOString() };
}

async function getReminder(ctx: Ctx, id: string) {
  return must(
    await ctx.db.from("reminders").select().eq("id", id).eq("user_id", ctx.userId).maybeSingle(),
    `reminder ${id}`,
  );
}

export async function snoozeReminder(ctx: Ctx, id: string, opts: { minutes?: number; until?: string }) {
  const before = await getReminder(ctx, id);
  const at = opts.until ? new Date(opts.until) : new Date(ctx.now.getTime() + (opts.minutes ?? 60) * 60_000);
  if (Number.isNaN(at.getTime()) || at <= ctx.now) throw new AppError("Snooze target must be in the future.");
  const after = must(
    await ctx.db.from("reminders").update({ next_fire_at: at.toISOString(), active: true }).eq("id", id).select().single(),
    "snooze reminder",
  );
  await logAction(ctx, {
    tool: "snooze_reminder",
    entityType: "reminder",
    entityId: id,
    before,
    after,
    summary: `Snoozed reminder until ${at.toISOString()}`,
  });
  return after;
}

export async function cancelReminder(ctx: Ctx, id: string) {
  const before = await getReminder(ctx, id);
  const after = must(
    await ctx.db.from("reminders").update({ active: false }).eq("id", id).select().single(),
    "cancel reminder",
  );
  await logAction(ctx, {
    tool: "cancel_reminder",
    entityType: "reminder",
    entityId: id,
    before,
    after,
    summary: `Cancelled reminder "${before.message ?? "task reminder"}"`,
  });
  return { cancelled: true };
}

export type DueReminder = {
  reminder_id: string;
  task_id: string | null;
  text: string;
  schedule: string;
  fire_count: number;
  until_done: boolean;
};

/**
 * Advance a reminder that just fired. Returns its patch (next fire time,
 * counters, deactivation). Pure apart from the inputs.
 */
export function advance(r: Reminder, now: Date, tz: string) {
  const schedule = scheduleSchema.safeParse(r.schedule);
  const fire_count = r.fire_count + 1;
  let next = schedule.success ? nextFire(schedule.data, now, tz) : null;
  let remaining = r.remaining_count;
  if (r.until_kind === "once") next = null;
  if (r.until_kind === "count") {
    remaining = (remaining ?? 1) - 1;
    if (remaining <= 0) next = null;
  }
  if (r.until_kind === "date" && next && r.until_date && localDate(next, tz) > r.until_date) next = null;
  return {
    fire_count,
    last_fired_at: now.toISOString(),
    remaining_count: remaining,
    next_fire_at: next?.toISOString() ?? null,
    active: next !== null,
    last_error: null,
  };
}
