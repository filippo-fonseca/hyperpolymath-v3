import "server-only";
import { AppError, must, type Ctx } from "./ctx";

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
