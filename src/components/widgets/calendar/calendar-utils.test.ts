import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/lib/dashboard-types";
import { addMonths, daySegments, eventSpan, layoutDay, monthGridStart, monthLabel, weekStart, type Segment } from "./calendar-utils";

const NY = "America/New_York";

function ev(id: string, start: string, end: string, all_day = false): CalendarEvent {
  return {
    id,
    title: id,
    when: "",
    start,
    end,
    all_day,
    location: null,
    description: null,
    calendar: "Work",
    account: "",
    link: null,
    color: null,
    updated: null,
  };
}

const seg = (id: string, start: number, end: number): Segment => ({ e: ev(id, "", ""), start, end });

describe("calendar ranges", () => {
  it("weeks start on Sunday", () => {
    expect(weekStart("2026-10-11")).toBe("2026-10-11"); // a Sunday
    expect(weekStart("2026-10-14")).toBe("2026-10-11");
  });
  it("month grid starts on the Sunday before the 1st", () => {
    expect(monthGridStart("2026-10-20")).toBe("2026-09-27");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", -1)).toBe("2025-12-01");
    expect(monthLabel("2026-10-20")).toBe("October 2026");
  });
});

describe("event spans", () => {
  it("treats all-day end dates as exclusive", () => {
    expect(eventSpan(ev("a", "2026-10-12", "2026-10-13", true), NY)).toEqual({ first: "2026-10-12", last: "2026-10-12" });
    expect(eventSpan(ev("b", "2026-10-12", "2026-10-15", true), NY)).toEqual({ first: "2026-10-12", last: "2026-10-14" });
  });
  it("clips overnight events per day", () => {
    const late = ev("c", "2026-10-13T02:00:00.000Z", "2026-10-13T06:00:00.000Z"); // 10pm to 2am NY
    expect(daySegments([late], "2026-10-12", NY)).toMatchObject([{ start: 22 * 60, end: 24 * 60 }]);
    expect(daySegments([late], "2026-10-13", NY)).toMatchObject([{ start: 0, end: 2 * 60 }]);
  });
  it("does not spill an event ending at midnight into the next day", () => {
    const e = ev("d", "2026-10-13T03:00:00.000Z", "2026-10-13T04:00:00.000Z"); // 11pm to midnight NY
    expect(daySegments([e], "2026-10-13", NY)).toEqual([]);
  });
});

describe("layoutDay", () => {
  const cols = (p: ReturnType<typeof layoutDay>) => Object.fromEntries(p.map((x) => [x.e.id, [x.col, x.cols]]));

  it("keeps non-overlapping events full width", () => {
    expect(cols(layoutDay([seg("a", 60, 120), seg("b", 120, 180)]))).toEqual({ a: [0, 1], b: [0, 1] });
  });
  it("puts overlapping events side by side", () => {
    expect(cols(layoutDay([seg("a", 60, 180), seg("b", 90, 150), seg("c", 100, 200)]))).toEqual({
      a: [0, 3],
      b: [1, 3],
      c: [2, 3],
    });
  });
  it("reuses freed columns inside a chained cluster", () => {
    // a overlaps b, b overlaps c, a ends before c starts: c reuses column 0.
    expect(cols(layoutDay([seg("a", 0, 60), seg("b", 30, 120), seg("c", 90, 150)]))).toEqual({
      a: [0, 2],
      b: [1, 2],
      c: [0, 2],
    });
  });
  it("gives tiny back-to-back events their own column with a minimum span", () => {
    expect(cols(layoutDay([seg("a", 60, 65), seg("b", 65, 70)], 20))).toEqual({ a: [0, 2], b: [1, 2] });
  });
});
