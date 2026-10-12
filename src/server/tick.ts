import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { adminDb, userTimezone, type DB, type Row } from "./ctx";
import { advance, type DueReminder } from "./reminders";
import { describeSchedule, scheduleSchema } from "@/lib/schedule";

// The reminder tick. Runs every few minutes: claims due reminders, batches
// them per user into ONE webhook call to the coordinator bot's "Reminder
// relay" routine (one Bot run per tick, not per reminder), then advances them.

type DueRow = Row<"reminders"> & { task: { title: string; status: string; deleted_at: string | null } | null };

export type TickResult = { users: number; sent: number; skipped: number; failed: number; errors: string[] };

export async function runTick(
  now = new Date(),
  deliver = deliverToKiwi,
  opts: { userId?: string } = {},
): Promise<TickResult> {
  const db = adminDb();
  const result: TickResult = { users: 0, sent: 0, skipped: 0, failed: 0, errors: [] };
  let q = db
    .from("reminders")
    .select("*, task:tasks(title, status, deleted_at)")
    .eq("active", true)
    .lte("next_fire_at", now.toISOString());
  if (opts.userId) q = q.eq("user_id", opts.userId);
  const { data, error } = await q.order("next_fire_at").limit(200);
  if (error) throw new Error(`tick query: ${error.message}`);
  const due = (data ?? []) as DueRow[];

  const byUser = new Map<string, DueRow[]>();
  for (const r of due) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);

  for (const [userId, rows] of byUser) {
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
    if (!batch.length) continue;

    try {
      await deliver(userId, batch, now, tz);
      result.sent += batch.length;
    } catch (e) {
      // Roll back the claim so the next tick retries, and surface the error.
      // Only rows still exactly as we left them: a cancel or snooze that
      // happened during delivery wins.
      const msg = e instanceof Error ? e.message : String(e);
      result.failed += batch.length;
      result.errors.push(msg);
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
 * POST the batch to the coordinator's Grok Bot routine webhook. The JSON body
 * becomes the routine run's input, so it carries plain-language instructions.
 */
export async function deliverToKiwi(_userId: string, batch: DueReminder[], now: Date, tz: string) {
  const url = process.env.KIWI_WEBHOOK_URL;
  const token = process.env.KIWI_WEBHOOK_TOKEN;
  if (!url || !token) throw new Error("KIWI_WEBHOOK_URL / KIWI_WEBHOOK_TOKEN not configured");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      source: "hyperpolymath",
      kind: "reminders_due",
      at: now.toISOString(),
      timezone: tz,
      instructions:
        "Nudge the owner about each reminder below in one short message, in Kiwi's voice (a composed British butler who addresses the owner as sir; at most one light touch of dry wit, none if anything is overdue or urgent). For until_done items, they can reply 'done' and you call complete_task with the task_id via the Hyperpolymath MCP. Check get_overview first in case something was already completed, and skip anything already done.",
      reminders: batch,
    }),
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
