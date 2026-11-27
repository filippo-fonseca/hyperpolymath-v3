import { describe, expect, it } from "vitest";
import { bestStreak, buildInsights, dayRange, habitRateDaily, headline, type InsightsRaw } from "./insights";
import { resolveSource, SOURCE_IDS, SOURCE_INFO } from "./widget-sources";
import { payloadSchemas } from "./widgets";

const tz = "America/New_York";
const today = "2026-11-27";

function raw(over: Partial<InsightsRaw> = {}): InsightsRaw {
  return {
    tz,
    today,
    tasks: [
      { created_at: "2026-11-20T14:00:00Z", completed_at: "2026-11-27T15:00:00Z", status: "done", project_id: "p1", due_date: "2026-11-28" },
      { created_at: "2026-11-20T14:00:00Z", completed_at: "2026-11-26T03:30:00Z", status: "done", project_id: null, due_date: "2026-11-24" },
      { created_at: "2026-11-25T14:00:00Z", completed_at: null, status: "todo", project_id: "p1", due_date: "2026-11-20" },
      { created_at: "2026-10-01T14:00:00Z", completed_at: "2026-10-02T14:00:00Z", status: "done", project_id: "p1", due_date: null },
    ],
    habits: [{ id: "h1", name: "Read", icon: "📚", days_of_week: [0, 1, 2, 3, 4, 5, 6], created_at: "2026-11-20T12:00:00Z", archived_at: null }],
    habitLogs: [
      { habit_id: "h1", date: "2026-11-25", progress: 3 },
      { habit_id: "h1", date: "2026-11-26", progress: 3 },
      { habit_id: "h1", date: "2026-11-27", progress: 1 },
    ],
    captures: [{ created_at: "2026-11-27T12:00:00Z" }],
    actions: [
      { created_at: "2026-11-27T12:00:00Z", actor_kind: "bot", bot_id: "b1" },
      { created_at: "2026-11-27T12:00:00Z", actor_kind: "user", bot_id: null },
    ],
    runs: [{ started_at: "2026-11-27T12:00:00Z", status: "ok" }],
    bots: [{ id: "b1", name: "Kiwi", avatar_color: "#1084fe" }],
    projects: [{ id: "p1", name: "Thermo", emoji: "🔥", area_id: "a1" }],
    areas: [{ id: "a1", name: "School", emoji: "🎓" }],
    ...over,
  };
}

describe("insights", () => {
  it("buckets completions by local day", () => {
    const i = buildInsights(raw(), 7);
    expect(i.days.at(-1)).toBe(today);
    // 03:30Z on the 26th is the evening of the 25th in New York.
    expect(i.done.at(-1)).toBe(1);
    expect(i.done.at(-3)).toBe(1);
    expect(i.kpis.done.value).toBe(2);
    expect(i.kpis.open).toBe(1);
    expect(i.kpis.overdue).toBe(1);
    expect(i.kpis.onTime.value).toBe(50);
  });

  it("gives habits partial credit and skips days before a habit existed", () => {
    const rates = habitRateDaily(raw(), dayRange(today, 10));
    expect(rates[0]).toBeNull();
    expect(rates.at(-1)).toBe(33);
    expect(rates.at(-2)).toBe(100);
  });

  it("finds the best streak without letting today break it", () => {
    const r = raw();
    const done = new Set(["2026-11-21", "2026-11-22", "2026-11-23", "2026-11-25", "2026-11-26"]);
    expect(bestStreak(r.habits[0], done, today, tz)).toBe(3);
  });

  it("writes a headline", () => {
    expect(headline(buildInsights(raw(), 7))).toMatch(/^You finished 2 tasks/);
    expect(headline(buildInsights(raw({ tasks: [], habits: [], habitLogs: [] }), 7))).toMatch(/Not much to read yet/);
  });

  it("every live source resolves to a valid payload for each kind it offers", () => {
    for (const id of SOURCE_IDS) {
      for (const kind of SOURCE_INFO[id].kinds) {
        for (const r of [raw(), raw({ tasks: [], habits: [], habitLogs: [], actions: [], runs: [], captures: [] })]) {
          for (const days of [7, 30, 90]) {
            const p = resolveSource(r, { id, days }, kind);
            const res = payloadSchemas[kind].safeParse(p);
            expect(res.success, `${id} as ${kind} (${days}d): ${res.success ? "" : JSON.stringify(res.error.issues)}`).toBe(true);
          }
        }
      }
    }
  });
});
