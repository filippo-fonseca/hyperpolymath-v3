import { describe, expect, it } from "vitest";
import { buildResurface, choiceFor, firstReturn, quickPicks, resurfaceBadge, summarize } from "./resurface-choice";
import { zonedToUtc } from "./time";

const NY = "America/New_York";
// Wednesday, Nov 11 2026, 2:20pm in New York
const NOW = zonedToUtc("2026-11-11", "14:20", NY);

describe("quickPicks", () => {
  it("offers later today, tomorrow, the weekend, next week and a month out", () => {
    const picks = Object.fromEntries(quickPicks(NOW, NY).map((p) => [p.id, `${p.date} ${p.time}`]));
    expect(picks).toEqual({
      later: "2026-11-11 18:00",
      tomorrow: "2026-11-12 09:00",
      weekend: "2026-11-14 09:00",
      week: "2026-11-16 09:00",
      month: "2026-12-11 09:00",
    });
  });

  it("drops later today in the evening", () => {
    const late = zonedToUtc("2026-11-11", "19:30", NY);
    expect(quickPicks(late, NY).map((p) => p.id)).not.toContain("later");
  });
});

describe("buildResurface", () => {
  const base = { date: "2026-11-16", time: "09:00", everyDays: 3 };
  it("maps each repeat option to a schedule", () => {
    expect(buildResurface({ ...base, repeat: "never" }, NY)).toEqual({
      schedule: { type: "once", date: "2026-11-16", time: "09:00" },
      startAt: null,
    });
    expect(buildResurface({ ...base, repeat: "weekdays" }, NY).schedule).toEqual({ type: "daily", times: ["09:00"], days: [1, 2, 3, 4, 5] });
    const every = buildResurface({ ...base, repeat: "every" }, NY);
    expect(every.schedule).toEqual({ type: "interval", every_minutes: 3 * 1440 });
    expect(every.startAt).toBe(zonedToUtc("2026-11-16", "09:00", NY).toISOString());
  });
});

describe("summarize", () => {
  it("reads like a sentence", () => {
    expect(summarize({ date: "2026-11-12", time: "09:00", repeat: "never", everyDays: 3 }, NOW, NY)).toBe("Comes back tomorrow at 9am.");
    expect(summarize({ date: "2026-11-13", time: "17:30", repeat: "never", everyDays: 3 }, NOW, NY)).toBe("Comes back on Friday at 5:30pm.");
    expect(summarize({ date: "2026-11-14", time: "09:00", repeat: "weekdays", everyDays: 3 }, NOW, NY)).toBe(
      "Comes back every weekday at 9am, starting Monday.",
    );
    expect(summarize({ date: "2026-11-12", time: "08:00", repeat: "every", everyDays: 4 }, NOW, NY)).toBe(
      "Comes back every 4 days at 8am, starting tomorrow.",
    );
  });

  it("says so when the time has passed", () => {
    const past = { date: "2026-11-11", time: "09:00", repeat: "never" as const, everyDays: 3 };
    expect(firstReturn(past, NOW, NY)).toBeNull();
    expect(summarize(past, NOW, NY)).toMatch(/already passed/);
  });
});

describe("choiceFor and resurfaceBadge", () => {
  it("round-trips a weekday schedule", () => {
    const c = { resurface_schedule: { type: "daily", times: ["09:00"], days: [1, 2, 3, 4, 5] }, resurface_next_at: zonedToUtc("2026-11-12", "09:00", NY).toISOString() };
    expect(choiceFor(c, NOW, NY)).toMatchObject({ repeat: "weekdays", time: "09:00", date: "2026-11-12" });
    expect(resurfaceBadge(c, NY, "2026-11-11")).toBe("Back tomorrow 9am · weekdays");
  });

  it("starts fresh from tomorrow when a one-off already came back", () => {
    const c = { resurface_schedule: { type: "once", date: "2026-10-20", time: "08:30" }, resurface_next_at: null };
    expect(choiceFor(c, NOW, NY)).toEqual({ date: "2026-11-12", time: "08:30", repeat: "never", everyDays: 3 });
  });

  it("defaults to tomorrow morning", () => {
    expect(choiceFor(null, NOW, NY)).toEqual({ date: "2026-11-12", time: "09:00", repeat: "never", everyDays: 3 });
    expect(resurfaceBadge({ resurface_schedule: null, resurface_next_at: null }, NY, "2026-11-11")).toBeNull();
  });
});
