import { describe, expect, it } from "vitest";
import { nextFire, firstFire } from "./schedule";
import { latestOccurrence, nextOccurrence } from "./recurrence";
import { currentStreak } from "./streak";
import { zonedToUtc, localDate } from "./time";

const NY = "America/New_York";

describe("time", () => {
  it("converts NY wall time to UTC across DST", () => {
    expect(zonedToUtc("2026-07-01", "10:00", NY).toISOString()).toBe("2026-07-01T14:00:00.000Z");
    expect(zonedToUtc("2026-12-01", "10:00", NY).toISOString()).toBe("2026-12-01T15:00:00.000Z");
  });
  it("finds the local date", () => {
    expect(localDate(new Date("2026-10-11T03:00:00Z"), NY)).toBe("2026-10-10");
  });
});

describe("schedule", () => {
  it("daily at 10am: next is tomorrow once today's slot passed", () => {
    const after = zonedToUtc("2026-10-11", "11:00", NY);
    const n = nextFire({ type: "daily", times: ["10:00"] }, after, NY)!;
    expect(n.toISOString()).toBe(zonedToUtc("2026-10-12", "10:00", NY).toISOString());
  });
  it("daily honours weekdays", () => {
    // 2026-10-11 is a Sunday; only Mondays allowed.
    const after = zonedToUtc("2026-10-11", "08:00", NY);
    const n = nextFire({ type: "daily", times: ["09:00"], days: [1] }, after, NY)!;
    expect(n.toISOString()).toBe(zonedToUtc("2026-10-12", "09:00", NY).toISOString());
  });
  it("interval stays inside its window", () => {
    const s = { type: "interval" as const, every_minutes: 180, window: { start: "09:00", end: "22:00" } };
    const late = zonedToUtc("2026-10-11", "21:00", NY);
    expect(nextFire(s, late, NY)!.toISOString()).toBe(zonedToUtc("2026-10-12", "09:00", NY).toISOString());
    const mid = zonedToUtc("2026-10-11", "12:00", NY);
    expect(nextFire(s, mid, NY)!.toISOString()).toBe(zonedToUtc("2026-10-11", "15:00", NY).toISOString());
  });
  it("interval first fire is now when inside the window", () => {
    const s = { type: "interval" as const, every_minutes: 180, window: { start: "09:00", end: "22:00" } };
    const now = zonedToUtc("2026-10-11", "12:00", NY);
    expect(firstFire(s, now, NY)!.toISOString()).toBe(now.toISOString());
    const early = zonedToUtc("2026-10-11", "06:00", NY);
    expect(firstFire(s, early, NY)!.toISOString()).toBe(zonedToUtc("2026-10-11", "09:00", NY).toISOString());
  });
  it("overnight windows run into the next morning", () => {
    const s = { type: "interval" as const, every_minutes: 60, window: { start: "22:00", end: "02:00" } };
    const late = zonedToUtc("2026-10-11", "23:30", NY);
    expect(nextFire(s, late, NY)!.toISOString()).toBe(zonedToUtc("2026-10-12", "00:30", NY).toISOString());
    const closing = zonedToUtc("2026-10-12", "01:30", NY);
    expect(nextFire(s, closing, NY)!.toISOString()).toBe(zonedToUtc("2026-10-12", "22:00", NY).toISOString());
  });
  it("once returns null after it passed", () => {
    const after = zonedToUtc("2026-10-12", "00:00", NY);
    expect(nextFire({ type: "once", date: "2026-10-11", time: "10:00" }, after, NY)).toBeNull();
  });
});

describe("recurrence", () => {
  it("weekly on Mon/Thu", () => {
    expect(nextOccurrence({ freq: "weekly", interval: 1, days: [1, 4] }, "2026-10-12")).toBe("2026-10-15");
    expect(nextOccurrence({ freq: "weekly", interval: 1, days: [1, 4] }, "2026-10-15")).toBe("2026-10-19");
  });
  it("monthly clamps to month end", () => {
    expect(nextOccurrence({ freq: "monthly", interval: 1 }, "2026-01-31")).toBe("2026-02-28");
  });
  it("monthly with an anchor day recovers after short months", () => {
    expect(nextOccurrence({ freq: "monthly", interval: 1, month_day: 31 }, "2026-02-28")).toBe("2026-03-31");
  });
  it("a missed daily task catches up to today", () => {
    expect(latestOccurrence({ freq: "daily", interval: 1 }, "2026-10-25", "2026-10-31")).toBe("2026-10-31");
  });
  it("a missed weekly task lands on the last occurrence, not today", () => {
    // Mon/Thu series due Mon Oct 19; on Sat Oct 31 the latest is Thu Oct 29.
    expect(latestOccurrence({ freq: "weekly", interval: 1, days: [1, 4] }, "2026-10-19", "2026-10-31")).toBe("2026-10-29");
  });
  it("leaves a task due today or later alone", () => {
    expect(latestOccurrence({ freq: "daily", interval: 1 }, "2026-10-31", "2026-10-31")).toBe("2026-10-31");
    expect(latestOccurrence({ freq: "daily", interval: 1 }, "2026-11-02", "2026-10-31")).toBe("2026-11-02");
  });
});

describe("streak", () => {
  it("skips unscheduled days and ignores unfinished today", () => {
    // Weekdays only. Done Thu 8, Fri 9, Mon 12; today Tue 13 unfinished.
    const done = new Set(["2026-10-08", "2026-10-09", "2026-10-12"]);
    expect(
      currentStreak({ today: "2026-10-13", startDate: "2026-10-01", daysOfWeek: [1, 2, 3, 4, 5], doneDates: done }),
    ).toBe(3);
  });
});

import { normalizeWidgetIcon } from "./widgets";

describe("widget icons", () => {
  it("turns domains into favicons, keeps emoji and https URLs", () => {
    expect(normalizeWidgetIcon("slack.com")).toBe("https://www.google.com/s2/favicons?domain=slack.com&sz=128");
    expect(normalizeWidgetIcon("www.linkedin.com/feed")).toContain("domain=linkedin.com");
    expect(normalizeWidgetIcon("📬")).toBe("📬");
    expect(normalizeWidgetIcon("https://example.com/i.png")).toBe("https://example.com/i.png");
    expect(normalizeWidgetIcon("")).toBeNull();
  });
  it("rejects http and junk", () => {
    expect(() => normalizeWidgetIcon("http://example.com/i.png")).toThrow(/https/);
    expect(() => normalizeWidgetIcon("javascript:alert(1)")).toThrow();
  });
});
