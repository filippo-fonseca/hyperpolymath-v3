import { describe, expect, it } from "vitest";
import { relayPayload } from "./tick";

const NOW = new Date("2026-11-10T14:00:00Z");
const reminder = {
  reminder_id: "r1",
  task_id: "t1",
  text: "Call the bank",
  schedule: "every day at 10:00",
  fire_count: 1,
  until_done: true,
};
const capture = { capture_id: "c1", excerpt: "Read the Fermi paper", schedule: "once on 2026-11-10 at 09:00" };

describe("relayPayload", () => {
  it("carries reminders and resurfaced captures in one body", () => {
    const body = relayPayload([reminder], NOW, "America/New_York", [capture]);
    expect(body.kind).toBe("reminders_due");
    expect(body.reminders).toEqual([reminder]);
    expect(body.resurfaced_captures).toEqual([capture]);
    expect(body.instructions).toMatch(/complete_task/);
    expect(body.instructions).toMatch(/mark_capture_seen/);
    expect(body.instructions).toMatch(/'seen'/);
  });

  it("works with captures alone", () => {
    const body = relayPayload([], NOW, "UTC", [capture]);
    expect(body.reminders).toEqual([]);
    expect(body.instructions).not.toMatch(/complete_task/);
    expect(body.instructions).toMatch(/mark_capture_seen/);
  });

  it("leaves capture wording out when nothing resurfaced", () => {
    const body = relayPayload([reminder], NOW, "UTC");
    expect(body.resurfaced_captures).toEqual([]);
    expect(body.instructions).not.toMatch(/mark_capture_seen/);
  });
});
