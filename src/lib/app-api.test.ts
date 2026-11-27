import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { appMeSchema, appSummarySchema, bucketByDay } from "./app-api";
import { addDays } from "./time";

// The same fixtures the Swift tests decode (apple/HyperpolymathKit). If a
// server shape changes, this fails until the fixture and the Swift models move too.
const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../apple/HyperpolymathKit/Tests/HyperpolymathKitTests/Fixtures/${name}.json`, import.meta.url), "utf8"));

describe("app API contract", () => {
  it("the summary fixture matches the server schema exactly", () => {
    const parsed = appSummarySchema.strict().parse(fixture("summary"));
    expect(parsed.activity).toHaveLength(14);
    expect(parsed.activity.at(-1)?.date).toBe(parsed.today);
  });

  it("the me fixture matches the server schema", () => {
    expect(appMeSchema.parse(fixture("me")).token.scope).toBe("app");
  });
});

describe("bucketByDay", () => {
  it("fills every day, oldest first, counting by local date", () => {
    const toLocal = (iso: string) => iso.slice(0, 10);
    const out = bucketByDay(["2026-11-27T01:00:00Z", "2026-11-27T09:00:00Z", "2026-11-25T12:00:00Z", "2026-10-01T00:00:00Z"], {
      today: "2026-11-27",
      days: 4,
      toLocal,
      addDays,
    });
    expect(out).toEqual([
      { date: "2026-11-24", count: 0 },
      { date: "2026-11-25", count: 1 },
      { date: "2026-11-26", count: 0 },
      { date: "2026-11-27", count: 2 },
    ]);
  });
});
