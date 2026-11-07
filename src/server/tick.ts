import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { adminDb, makeCtx, userTimezone, type DB, type Row } from "./ctx";
import { advance, type DueReminder } from "./reminders";
import { describeSchedule, scheduleSchema } from "@/lib/schedule";
import { getRelay } from "./relay";
import { catchUpRecurring } from "./tasks";
import { localDate } from "@/lib/time";
import { advanceResurface, describeResurface, excerpt } from "@/lib/resurface";

// The reminder tick. Runs every few minutes: claims due reminders and captures
// due to resurface, batches them per user into ONE webhook call to the
// coordinator bot's "Reminder relay" routine (one Bot run per tick, not per
// item), then advances them.

type DueRow = Row<"reminders"> & { task: { title: string; status: string; deleted_at: string | null } | null };
type DueCapture = Pick<Row<"captures">, "id" | "user_id" | "content" | "resurface_schedule" | "resurface_next_at">;

/** A capture that just came back, as the relay payload carries it. */
export type ResurfacedCapture = { capture_id: string; excerpt: string; schedule: string };

export type TickResult = {
  users: number;
  sent: number;
  skipped: number;
  failed: number;
  /** Captures brought back into Resurfaced this tick (delivered or not). */
  resurfaced: number;
  errors: string[];
};

export async function runTick(
  now = new Date(),
  deliver = deliverToKiwi,
  opts: { userId?: string } = {},
): Promise<TickResult> {
  const db = adminDb();
  const result: TickResult = { users: 0, sent: 0, skipped: 0, failed: 0, resurfaced: 0, errors: [] };
  let q = db
    .from("reminders")
    .select("*, task:tasks(title, status, deleted_at)")
    .eq("active", true)
    .lte("next_fire_at", now.toISOString());
  if (opts.userId) q = q.eq("user_id", opts.userId);
  const { data, error } = await q.order("next_fire_at").limit(200);
  if (error) throw new Error(`tick query: ${error.message}`);
  const due = (data ?? []) as DueRow[];

  let cq = db
    .from("captures")
    .select("id, user_id, content, resurface_schedule, resurface_next_at")
    .not("resurface_next_at", "is", null)
    .lte("resurface_next_at", now.toISOString())
    .is("deleted_at", null)
    .is("archived_at", null);
  if (opts.userId) cq = cq.eq("user_id", opts.userId);
  const { data: capData, error: capError } = await cq.order("resurface_next_at").limit(200);
  if (capError) throw new Error(`tick captures query: ${capError.message}`);
  const dueCaptures = (capData ?? []) as DueCapture[];

  const byUser = new Map<string, { reminders: DueRow[]; captures: DueCapture[] }>();
  const slot = (userId: string) => {
    let s = byUser.get(userId);
    if (!s) byUser.set(userId, (s = { reminders: [], captures: [] }));
    return s;
  };
  for (const r of due) slot(r.user_id).reminders.push(r);
  for (const c of dueCaptures) slot(c.user_id).captures.push(c);

  for (const [userId, { reminders: rows, captures }] of byUser) {
    result.users++;
    const tz = await userTimezone(db, userId);
    const batch: DueReminder[] = [];
    const claimed: { row: DueRow; patch: ReturnType<typeof advance> }[] = [];

    for (const r of rows) {
      // Task finished or deleted: an until-done reminder retires quietly.
      if (r.task && (r.task.deleted_at || (r.task.status === "done" && r.until_kind === "done"))) {
        await db.from("reminders").update({ active: false }).eq("id", r.id);
        result.skipped++;
        continue;
      }
      const patch = advance(r, now, tz);
      // Claim: only proceed if nobody else advanced this reminder meanwhile.
      const { data: won } = await db
        .from("reminders")
        .update(patch)
        .eq("id", r.id)
        .eq("next_fire_at", r.next_fire_at!)
        .select("id");
      if (!won?.length) continue;
      claimed.push({ row: r, patch });
      const s = scheduleSchema.safeParse(r.schedule);
      batch.push({
        reminder_id: r.id,
        task_id: r.task_id,
        text: r.task?.title ?? r.message ?? "Reminder",
        schedule: s.success ? describeSchedule(s.data) : "custom",
        fire_count: patch.fire_count,
        until_done: r.until_kind === "done" && !!r.task_id,
      });
    }

    // Captures: mark resurfaced now and step the schedule. Same optimistic
    // claim as reminders, matching the resurface_next_at we read.
    const resurfaced: ResurfacedCapture[] = [];
    for (const c of captures) {
      const patch = advanceResurface(c.resurface_schedule, c.resurface_next_at, now, tz);
      const { data: won } = await db
        .from("captures")
        .update(patch)
        .eq("id", c.id)
        .eq("resurface_next_at", c.resurface_next_at!)
        .select("id");
      if (!won?.length) continue;
      result.resurfaced++;
      resurfaced.push({
        capture_id: c.id,
        excerpt: excerpt(c.content, 280),
        schedule: describeResurface(c.resurface_schedule),
      });
    }
    if (!batch.length && !resurfaced.length) continue;

    try {
      await deliver(userId, batch, now, tz, resurfaced);
      result.sent += batch.length;
    } catch (e) {
      // Resurfaced captures are NOT rolled back: they already sit in the
      // dashboard's Resurfaced section until marked seen, so nothing is lost,
      // and their schedule stays advanced. Retrying them every tick would
      // churn forever for accounts without a relay. Only reminders retry.
      //
      // Reminders: roll back the claim so the next tick retries, and surface
      // the error. Only rows still exactly as we left them: a cancel or
      // snooze that happened during delivery wins.
      const msg = e instanceof Error ? e.message : String(e);
      result.failed += batch.length;
      // Captures alone, no relay set up: the dashboard is enough, not an error.
      if (batch.length || !msg.startsWith("No reminder relay")) result.errors.push(msg);
      await Promise.all(
        claimed.map(({ row, patch }) => {
          let q = db
            .from("reminders")
            .update({
              next_fire_at: row.next_fire_at,
              fire_count: row.fire_count,
              last_fired_at: row.last_fired_at,
              remaining_count: row.remaining_count,
              active: true,
              last_error: msg.slice(0, 500),
            })
            .eq("id", row.id)
            .eq("fire_count", patch.fire_count)
            .eq("active", patch.active);
          q = patch.next_fire_at ? q.eq("next_fire_at", patch.next_fire_at) : q.is("next_fire_at", null);
          return q;
        }),
      );
    }
  }
  return result;
}

/**
 * Roll every account's missed recurring tasks forward to their latest
 * occurrence. Anything dated on or before today in UTC could be behind in
 * some timezone; catchUpRecurring checks each user's own date.
 */
export async function catchUpRecurringAll(now = new Date(), opts: { userId?: string } = {}) {
  const db = adminDb();
  let q = db
    .from("tasks")
    .select("user_id")
    .is("deleted_at", null)
    .neq("status", "done")
    .not("recurrence", "is", null)
    .lte("due_date", localDate(now, "UTC"));
  if (opts.userId) q = q.eq("user_id", opts.userId);
  const { data, error } = await q.limit(1000);
  if (error) throw new Error(`catch-up query: ${error.message}`);
  let moved = 0;
  for (const userId of new Set((data ?? []).map((r) => r.user_id))) {
    const ctx = { ...(await makeCtx(userId, { kind: "system", name: "repeats" })), now };
    moved += (await catchUpRecurring(ctx)).length;
  }
  return moved;
}

const REMINDER_INSTRUCTIONS =
  "Nudge the owner about each reminder below in one short message, in Kiwi's voice (a composed British butler who addresses the owner as sir; at most one light touch of dry wit, none if anything is overdue or urgent). For until_done items, they can reply 'done' and you call complete_task with the task_id via the Hyperpolymath MCP. Check get_overview first in case something was already completed, and skip anything already done.";

const CAPTURE_INSTRUCTIONS =
  "resurfaced_captures are notes the owner asked to see again. Mention them briefly, a short line each, after any reminders (or on their own if there are none), in the same voice and with no pressure. If the owner replies 'seen' (or similar), call mark_capture_seen with the capture_id via the Hyperpolymath MCP. If they want it back again later, call update_capture with a new resurface schedule.";

/** The JSON body for the relay webhook. Pure, so the wording is testable. */
export function relayPayload(batch: DueReminder[], now: Date, tz: string, resurfaced: ResurfacedCapture[] = []) {
  const parts = [batch.length ? REMINDER_INSTRUCTIONS : null, resurfaced.length ? CAPTURE_INSTRUCTIONS : null];
  return {
    source: "hyperpolymath",
    kind: "reminders_due",
    at: now.toISOString(),
    timezone: tz,
    instructions: parts.filter(Boolean).join(" "),
    reminders: batch,
    resurfaced_captures: resurfaced,
  };
}

/**
 * POST the batch to this account's own Grok Bot "Reminder relay" webhook. The
 * JSON body becomes the routine run's input, so it carries plain-language
 * instructions.
 */
export async function deliverToKiwi(
  userId: string,
  batch: DueReminder[],
  now: Date,
  tz: string,
  resurfaced: ResurfacedCapture[] = [],
) {
  const relay = await getRelay(adminDb(), userId);
  if (!relay) throw new Error("No reminder relay set up. Add the Reminder relay webhook in Settings, Reminders.");
  const { url, token } = relay;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(relayPayload(batch, now, tz, resurfaced)),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Kiwi webhook ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/** Shared secret check: the cron caller's bearer must match the Vault secret. */
export async function verifyCronSecret(db: DB, presented: string | null): Promise<boolean> {
  if (!presented) return false;
  const env = process.env.CRON_SECRET;
  if (env) {
    const digest = (v: string) => createHash("sha256").update(v).digest();
    if (timingSafeEqual(digest(presented), digest(env))) return true;
  }
  // Cheap shape check before touching Vault: the generated secret is 64 hex chars.
  if (!/^[0-9a-f]{64}$/.test(presented)) return false;
  const { data } = await db.rpc("check_cron_secret", { presented });
  return data === true;
}
