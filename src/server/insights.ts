import "server-only";
import { must, type Ctx } from "./ctx";
import { buildInsightsData, type InsightsData, type InsightsRaw } from "@/lib/insights";
import { addDays, localDate, zonedToUtc } from "@/lib/time";

// Loads the rows analytics read, bounded to a window, scoped to the owner.
// Everything is read-only; the math lives in src/lib/insights.ts.

const PAGE = 1000; // Supabase caps a response at 1000 rows by default.

/** Read every row of a query in pages (bounded, so a huge log can't stall the page). */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, what: string, maxPages = 20) {
  const out: T[] = [];
  for (let i = 0; i < maxPages; i++) {
    const rows = must(await page(i * PAGE, i * PAGE + PAGE - 1), what);
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/** Rows for the last `days` local days (plus every open task, for backlog numbers). */
export async function loadInsightsRaw(ctx: Ctx, days: number): Promise<InsightsRaw> {
  const today = localDate(ctx.now, ctx.tz);
  const fromDate = addDays(today, -days);
  const from = zonedToUtc(fromDate, "00:00", ctx.tz).toISOString();
  const db = ctx.db;
  const uid = ctx.userId;
  const [done, open, habits, habitLogs, captures, actions, runs, bots, projects, areas] = await Promise.all([
    all((a, b) => db.from("tasks").select("created_at, completed_at, status, project_id, due_date").eq("user_id", uid).is("deleted_at", null).eq("status", "done").gte("completed_at", from).order("completed_at").range(a, b), "done tasks"),
    all((a, b) => db.from("tasks").select("created_at, completed_at, status, project_id, due_date").eq("user_id", uid).is("deleted_at", null).neq("status", "done").order("created_at").range(a, b), "open tasks"),
    db.from("habits").select("id, name, icon, days_of_week, created_at, archived_at").eq("user_id", uid),
    all((a, b) => db.from("habit_logs").select("habit_id, date, progress").eq("user_id", uid).gte("date", addDays(today, -Math.max(days, 400))).order("date").range(a, b), "habit logs"),
    all((a, b) => db.from("captures").select("created_at").eq("user_id", uid).is("deleted_at", null).gte("created_at", from).order("created_at").range(a, b), "captures"),
    all((a, b) => db.from("actions").select("created_at, actor_kind, bot_id").eq("user_id", uid).gte("created_at", from).order("created_at").range(a, b), "actions", 40),
    all((a, b) => db.from("routine_runs").select("started_at, status").eq("user_id", uid).gte("started_at", from).order("started_at").range(a, b), "routine runs"),
    db.from("bots").select("id, name, avatar_color").eq("user_id", uid),
    db.from("projects").select("id, name, emoji, area_id").eq("user_id", uid).is("deleted_at", null),
    db.from("areas").select("id, name, emoji").eq("user_id", uid).is("deleted_at", null),
  ]);
  return {
    tz: ctx.tz,
    today,
    // A task created in the window is either done since (in `done`) or still open.
    tasks: [...done, ...open],
    habits: must(habits, "habits"),
    habitLogs,
    captures,
    actions,
    runs,
    bots: must(bots, "bots"),
    projects: must(projects, "projects"),
    areas: must(areas, "areas"),
  };
}

/** The Insights page: every range at once, so switching is instant and animates. */
export async function getInsights(ctx: Ctx): Promise<InsightsData> {
  // Twice the longest range (for the previous-period comparison), and at
  // least half a year for the consistency heatmap.
  return buildInsightsData(await loadInsightsRaw(ctx, 182));
}
