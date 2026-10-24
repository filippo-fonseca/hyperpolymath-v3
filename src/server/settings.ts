import "server-only";
import { AppError, asJson, must, type Ctx } from "./ctx";
import { parseTaskViews, type TaskViewKey, type TaskViewPrefs, type TaskViews } from "@/lib/task-view";

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Change the owner's timezone (e.g. while travelling). Dates, "today", habit
 * days and reminder times all follow it. Existing reminders keep their next
 * fire instant and adopt the new zone from the following one.
 */
export async function setTimezone(ctx: Ctx, timezone: string) {
  const tz = timezone.trim();
  if (!isValidTimezone(tz)) throw new AppError(`"${timezone}" isn't an IANA timezone (e.g. Europe/Rome).`);
  const row = must(
    await ctx.db.from("settings").upsert({ user_id: ctx.userId, timezone: tz }, { onConflict: "user_id" }).select().single(),
    "set timezone",
  );
  return { timezone: row.timezone, previous: ctx.tz };
}

/** The owner's task list options, saved values over the defaults. */
export async function getTaskViews(ctx: Ctx): Promise<TaskViews> {
  const { data } = await ctx.db.from("settings").select("task_view").eq("user_id", ctx.userId).maybeSingle();
  return parseTaskViews(data?.task_view);
}

/**
 * Save one tab's sort, grouping and filters. A display preference, not data,
 * so it isn't logged in the activity view.
 */
export async function setTaskView(ctx: Ctx, view: TaskViewKey, prefs: TaskViewPrefs) {
  const current = await getTaskViews(ctx);
  const next = parseTaskViews({ ...current, [view]: prefs });
  must(
    await ctx.db
      .from("settings")
      .upsert({ user_id: ctx.userId, task_view: asJson(next) }, { onConflict: "user_id" })
      .select("user_id")
      .single(),
    "save task view",
  );
  return next[view];
}
