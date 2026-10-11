import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { advance } = await import("./reminders");
import { zonedToUtc } from "@/lib/time";

const NY = "America/New_York";

function reminder(over: Record<string, unknown>) {
  return {
    id: "r",
    user_id: "u",
    task_id: "t",
    message: null,
    schedule: { type: "daily", times: ["10:00"] },
    until_kind: "done",
    until_date: null,
    remaining_count: null,
    next_fire_at: null,
    last_fired_at: null,
    fire_count: 0,
    active: true,
    last_error: null,
    created_by: "Kiwi",
    created_at: "",
    updated_at: "",
    ...over,
  } as Parameters<typeof advance>[0];
}

describe("advance", () => {
  const now = zonedToUtc("2026-10-11", "10:00", NY);

  it("until done keeps going to the next slot", () => {
    const p = advance(reminder({}), now, NY);
    expect(p.active).toBe(true);
    expect(p.next_fire_at).toBe(zonedToUtc("2026-10-12", "10:00", NY).toISOString());
    expect(p.fire_count).toBe(1);
  });

  it("once deactivates", () => {
    expect(advance(reminder({ until_kind: "once" }), now, NY).active).toBe(false);
  });

  it("count runs down", () => {
    expect(advance(reminder({ until_kind: "count", remaining_count: 2 }), now, NY).active).toBe(true);
    expect(advance(reminder({ until_kind: "count", remaining_count: 1 }), now, NY).active).toBe(false);
  });

  it("until date stops after the date", () => {
    expect(advance(reminder({ until_kind: "date", until_date: "2026-10-11" }), now, NY).active).toBe(false);
    expect(advance(reminder({ until_kind: "date", until_date: "2026-10-12" }), now, NY).active).toBe(true);
  });
});
