import "server-only";
import { adminDb, asJson, must, type Ctx, type DB } from "./ctx";
import { googleConfigured, listAccounts } from "./google/oauth";

// Health and setup state for the Settings page, plus a full data export.

/** Called by the reminder tick so Settings can show when checks last ran. */
export async function recordTickHeartbeat(db: DB, result: unknown) {
  await db
    .from("system_state")
    .upsert({ key: "tick", value: asJson({ at: new Date().toISOString(), result }), updated_at: new Date().toISOString() });
}

export type SetupStatus = {
  mcp: { tokens: number; last_used_at: string | null };
  kiwi: { connected: boolean; name: string | null; last_seen_at: string | null };
  relay: { configured: boolean; last_tick_at: string | null; failing: { count: number; last_error: string | null } };
  google: { configured: boolean; accounts: number };
  counts: { tasks: number; projects: number; habits: number; captures: number; bots: number; routines: number };
};

export async function setupStatus(ctx: Ctx): Promise<SetupStatus> {
  const db = ctx.db;
  const uid = ctx.userId;
  const count = async (table: "tasks" | "projects" | "habits" | "captures" | "bots" | "routines", archivedCol?: string) => {
    let q = db.from(table).select("id", { count: "exact", head: true }).eq("user_id", uid);
    if (table !== "bots" && table !== "habits") q = q.is("deleted_at", null);
    if (archivedCol) q = q.is(archivedCol, null);
    const { count: n } = await q;
    return n ?? 0;
  };
  const [tokens, kiwi, tick, failing, accounts, tasks, projects, habits, captures, bots, routines] = await Promise.all([
    db.from("mcp_tokens").select("last_used_at").eq("user_id", uid).is("revoked_at", null).order("last_used_at", { ascending: false, nullsFirst: false }),
    db.from("bots").select("name, last_seen_at").eq("user_id", uid).eq("is_coordinator", true).maybeSingle(),
    adminDb().from("system_state").select("value, updated_at").eq("key", "tick").maybeSingle(),
    db.from("reminders").select("last_error, updated_at").eq("user_id", uid).eq("active", true).not("last_error", "is", null).order("updated_at", { ascending: false }),
    listAccounts(db, uid).catch(() => []),
    count("tasks"),
    count("projects", "archived_at"),
    count("habits", "archived_at"),
    count("captures", "archived_at"),
    count("bots", "archived_at"),
    count("routines"),
  ]);
  const tokenRows = tokens.data ?? [];
  return {
    mcp: { tokens: tokenRows.length, last_used_at: tokenRows[0]?.last_used_at ?? null },
    kiwi: { connected: !!kiwi.data, name: kiwi.data?.name ?? null, last_seen_at: kiwi.data?.last_seen_at ?? null },
    relay: {
      configured: !!(process.env.KIWI_WEBHOOK_URL && process.env.KIWI_WEBHOOK_TOKEN),
      last_tick_at: tick.data?.updated_at ?? null,
      failing: { count: failing.data?.length ?? 0, last_error: failing.data?.[0]?.last_error ?? null },
    },
    google: { configured: googleConfigured(), accounts: accounts.length },
    counts: { tasks, projects, habits, captures, bots, routines },
  };
}

const EXPORT_TABLES = [
  "settings",
  "areas",
  "projects",
  "tasks",
  "reminders",
  "habits",
  "habit_logs",
  "captures",
  "widgets",
  "widget_snapshots",
  "bots",
  "routines",
  "routine_runs",
  "actions",
] as const;

/** Everything the owner has, as plain JSON (secrets and tokens excluded). */
export async function exportAll(ctx: Ctx) {
  const out: Record<string, unknown> = {
    exported_at: ctx.now.toISOString(),
    format: "hyperpolymath-v3-export/1",
  };
  for (const table of EXPORT_TABLES) {
    out[table] = must(await ctx.db.from(table).select("*").eq("user_id", ctx.userId), `export ${table}`);
  }
  const accounts = await listAccounts(ctx.db, ctx.userId).catch(() => []);
  out.google_accounts = accounts.map((a) => ({ email: a.email, calendar_ids: a.calendar_ids, default_calendar_id: a.default_calendar_id, enabled: a.enabled, is_default: a.is_default }));
  return out;
}
