import { describe, expect, it } from "vitest";
import type { Task } from "./dashboard-types";
import { dayHeading, dueTone, nextDays, priorityLabel, quickDates, sortDay, sortOverdue } from "./today";

const task = (id: string, extra: Partial<Task> = {}) =>
  ({ id, title: id, due_date: "2026-10-22", due_time: null, priority: 0, position: 0, ...extra }) as Task;

describe("today helpers", () => {
  it("labels stored priorities the Todoist way", () => {
    expect([3, 2, 1, 0].map(priorityLabel)).toEqual(["P1", "P2", "P3", "P4"]);
  });

  it("puts timed tasks first, then priority, then position", () => {
    const rows = sortDay([
      task("low", { priority: 0, position: 1 }),
      task("late", { due_time: "17:00:00" }),
      task("high", { priority: 3, position: 5 }),
      task("early", { due_time: "09:30:00", priority: 0 }),
      task("first", { priority: 0, position: -2 }),
    ]);
    expect(rows.map((t) => t.id)).toEqual(["early", "late", "high", "first", "low"]);
  });

  it("orders overdue by day, oldest first", () => {
    const rows = sortOverdue([
      task("yesterday", { due_date: "2026-10-21", priority: 3 }),
      task("last week", { due_date: "2026-10-15" }),
      task("yesterday low", { due_date: "2026-10-21" }),
    ]);
    expect(rows.map((t) => t.id)).toEqual(["last week", "yesterday", "yesterday low"]);
  });

  it("picks schedule dates from a Thursday", () => {
    expect(quickDates("2026-10-22")).toEqual({
      today: "2026-10-22",
      tomorrow: "2026-10-23",
      weekend: "2026-10-24",
      nextWeek: "2026-10-26",
    });
  });

  it("treats Saturday as this weekend and Monday's next week as a week out", () => {
    expect(quickDates("2026-10-24").weekend).toBe("2026-10-24");
    expect(quickDates("2026-10-25").weekend).toBe("2026-10-31");
    expect(quickDates("2026-10-26").nextWeek).toBe("2026-11-02");
  });

  it("tones due dates", () => {
    expect(["2026-10-20", "2026-10-22", "2026-10-23", "2026-10-30"].map((d) => dueTone(d, "2026-10-22"))).toEqual([
      "overdue",
      "today",
      "tomorrow",
      "later",
    ]);
  });

  it("formats headings and the upcoming days", () => {
    expect(dayHeading("2026-10-22")).toBe("Thu Oct 22");
    expect(nextDays("2026-10-30", 3)).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});
