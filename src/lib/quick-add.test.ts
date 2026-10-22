import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./quick-add";

// 2026-10-22 is a Thursday.
const today = "2026-10-22";
const projects = [
  { id: "p-admin", name: "Admin" },
  { id: "p-side", name: "Side project" },
  { id: "p-sidequest", name: "Side" },
];
const parse = (s: string) => parseQuickAdd(s, { today, projects });

describe("parseQuickAdd", () => {
  it("leaves plain titles alone", () => {
    expect(parse("Buy milk")).toEqual({ title: "Buy milk", tokens: [] });
  });

  it("reads today, tomorrow and weekday names", () => {
    expect(parse("Buy milk today").due_date).toBe("2026-10-22");
    expect(parse("Buy milk Tomorrow").due_date).toBe("2026-10-23");
    expect(parse("Pay rent friday").due_date).toBe("2026-10-23");
    expect(parse("Pay rent monday").due_date).toBe("2026-10-26");
    // Today's own weekday means next week.
    expect(parse("Team sync thursday").due_date).toBe("2026-10-29");
  });

  it("reads 12h and 24h times, with or without at", () => {
    expect(parse("Call mom 5pm").due_time).toBe("17:00");
    expect(parse("Call mom at 5:30 PM").due_time).toBe("17:30");
    expect(parse("Call mom 12am").due_time).toBe("00:00");
    expect(parse("Call mom 12pm").due_time).toBe("12:00");
    expect(parse("Standup 09:15").due_time).toBe("09:15");
    expect(parse("Standup at 17:00").title).toBe("Standup");
    expect(parse("Room 13pm").due_time).toBeUndefined();
  });

  it("maps p1 to p4 onto the stored 3 to 0 scale", () => {
    expect(parse("Taxes p1").priority).toBe(3);
    expect(parse("Taxes P2").priority).toBe(2);
    expect(parse("Taxes p3").priority).toBe(1);
    expect(parse("Taxes p4").priority).toBe(0);
    expect(parse("Taxes p5").priority).toBeUndefined();
  });

  it("matches projects by name, longest first, and squashed names", () => {
    expect(parse("Email the lawyer #admin").project_id).toBe("p-admin");
    expect(parse("Ship it #Side project now").project_id).toBe("p-side");
    expect(parse("Ship it #Side now").project_id).toBe("p-sidequest");
    expect(parse("Ship it #SideProject").project_id).toBe("p-side");
    expect(parse("Ship it #unknown").project_id).toBeUndefined();
    expect(parse("Ship it #unknown").title).toBe("Ship it #unknown");
  });

  it("strips the tokens and reports where they were", () => {
    const r = parse("Call the bank tomorrow at 5pm p1 #Admin");
    expect(r).toMatchObject({ title: "Call the bank", due_date: "2026-10-23", due_time: "17:00", priority: 3, project_id: "p-admin" });
    expect(r.tokens.map((t) => [t.kind, t.text])).toEqual([
      ["date", "tomorrow"],
      ["time", "at 5pm"],
      ["priority", "p1"],
      ["project", "#Admin"],
    ]);
  });

  it("keeps the last mention of a kind and leaves the others as text", () => {
    const r = parse("Plan today, no wait tomorrow");
    expect(r.due_date).toBe("2026-10-23");
    expect(r.title).toBe("Plan today, no wait");
  });

  it("needs whole words", () => {
    expect(parse("Todays plan").due_date).toBeUndefined();
    expect(parse("Fix bp1 sensor").priority).toBeUndefined();
    expect(parse("Pay 5pmx").due_time).toBeUndefined();
    expect(parse("Pay today.").due_date).toBe("2026-10-22");
  });
});
