import { describe, expect, it } from "vitest";
import { advanceResurface, describeResurface, excerpt } from "./resurface";
import { zonedToUtc } from "./time";

const NY = "America/New_York";

describe("advanceResurface", () => {
  it("brings a once capture back and leaves nothing scheduled", () => {
    const at = zonedToUtc("2026-11-10", "09:00", NY);
    const now = new Date(at.getTime() + 60_000);
    const r = advanceResurface({ type: "once", date: "2026-11-10", time: "09:00" }, at.toISOString(), now, NY);
    expect(r).toEqual({ resurfaced_at: now.toISOString(), resurface_next_at: null });
  });

  it("steps a daily schedule to the next day", () => {
    const at = zonedToUtc("2026-11-10", "09:00", NY);
    const now = new Date(at.getTime() + 3 * 60_000);
    const r = advanceResurface({ type: "daily", times: ["09:00"] }, at.toISOString(), now, NY);
    expect(r.resurface_next_at).toBe(zonedToUtc("2026-11-11", "09:00", NY).toISOString());
  });

  it("skips slots missed while the tick was down instead of replaying them", () => {
    const at = zonedToUtc("2026-11-10", "09:00", NY);
    const now = zonedToUtc("2026-11-13", "12:00", NY);
    const r = advanceResurface({ type: "daily", times: ["09:00"] }, at.toISOString(), now, NY);
    expect(r.resurface_next_at).toBe(zonedToUtc("2026-11-14", "09:00", NY).toISOString());
  });

  it("keeps weekdays-only schedules off the weekend", () => {
    const fri = zonedToUtc("2026-11-13", "09:00", NY); // a Friday
    const r = advanceResurface({ type: "daily", times: ["09:00"], days: [1, 2, 3, 4, 5] }, fri.toISOString(), new Date(fri.getTime() + 1000), NY);
    expect(r.resurface_next_at).toBe(zonedToUtc("2026-11-16", "09:00", NY).toISOString());
  });

  it("steps every-N-days intervals from the scheduled slot", () => {
    const at = zonedToUtc("2026-11-10", "09:00", NY);
    const r = advanceResurface({ type: "interval", every_minutes: 3 * 24 * 60 }, at.toISOString(), new Date(at.getTime() + 5 * 60_000), NY);
    expect(r.resurface_next_at).toBe(zonedToUtc("2026-11-13", "09:00", NY).toISOString());
  });

  it("stops on a schedule it can't read", () => {
    const now = new Date("2026-11-10T15:00:00Z");
    expect(advanceResurface({ nope: true }, null, now, NY).resurface_next_at).toBeNull();
  });
});

describe("excerpt", () => {
  it("keeps short text and collapses whitespace", () => {
    expect(excerpt("  buy\n\nmilk  ")).toBe("buy milk");
  });

  it("cuts long text at a word, within the limit", () => {
    const long = "word ".repeat(100);
    const out = excerpt(long, 280);
    expect(out.length).toBeLessThanOrEqual(280);
    expect(out.endsWith("word…")).toBe(true);
  });
});

describe("describeResurface", () => {
  it("describes known schedules and falls back to custom", () => {
    expect(describeResurface({ type: "daily", times: ["09:00"] })).toBe("every day at 09:00");
    expect(describeResurface(null)).toBe("custom");
  });
});
