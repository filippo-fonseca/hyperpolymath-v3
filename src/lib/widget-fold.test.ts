import { describe, expect, it } from "vitest";
import { foldReason, isStale } from "./widget-fold";
import { parseWhen, whenIsPast, whenIsSoon, whenLabel } from "./format";
import { payloadSchemas } from "./widgets";

const NY = "America/New_York";
const NOW = Date.parse("2026-11-27T15:00:00Z"); // Fri Nov 27, 10am in New York
const TODAY = "2026-11-27";
const widget = (kind: string, payload: unknown, extra: Partial<{ published_at: string | null; stale_after_hours: number | null }> = {}) => ({
  kind,
  payload,
  published_at: "2026-11-27T12:00:00Z",
  stale_after_hours: null,
  ...extra,
});

describe("structured times", () => {
  it("reads an offset time in the owner's timezone", () => {
    const w = parseWhen("2026-11-30T23:59:00-05:00", NY)!;
    expect(w).toMatchObject({ date: "2026-11-30", time: "23:59" });
    expect(whenLabel(w, TODAY)).toBe("Mon 11:59pm");
  });
  it("converts across zones", () => {
    // 6:05am in Costa Rica is 7:05am in New York.
    expect(whenLabel(parseWhen("2026-12-18T06:05:00-06:00", NY)!, TODAY)).toBe("Fri, Dec 18 7:05am");
    expect(whenLabel(parseWhen("2026-12-18T06:05:00-06:00", NY)!, TODAY, true)).toBe("Dec 18 7:05am");
  });
  it("treats a time without an offset as the owner's wall clock", () => {
    const w = parseWhen("2026-11-28T09:30", NY)!;
    expect(w.instant).toBe(Date.parse("2026-11-28T14:30:00Z"));
    expect(whenLabel(w, TODAY)).toBe("Tomorrow 9:30am");
  });
  it("labels bare dates and other years", () => {
    expect(whenLabel(parseWhen("2026-11-27", NY)!, TODAY)).toBe("Today");
    expect(whenLabel(parseWhen("2027-01-09", NY)!, TODAY)).toBe("Jan 9, 2027");
  });
  it("knows past and soon", () => {
    const earlier = parseWhen("2026-11-27T08:00", NY)!;
    const later = parseWhen("2026-11-27T18:00", NY)!;
    expect(whenIsPast(earlier, NOW, TODAY)).toBe(true);
    expect(whenIsSoon(later, NOW, TODAY)).toBe(true);
    // A bare date is not past until the day is over.
    expect(whenIsPast(parseWhen(TODAY, NY)!, NOW, TODAY)).toBe(false);
  });
  it("rejects junk", () => {
    expect(parseWhen("next tuesday", NY)).toBeNull();
    expect(payloadSchemas.list.safeParse({ items: [{ text: "x", at: "soon" }] }).success).toBe(false);
    expect(payloadSchemas.list.safeParse({ items: [{ text: "x", at: "2026-11-30T23:59" }] }).success).toBe(true);
    expect(payloadSchemas.timeline.safeParse({ events: [{ text: "x" }] }).success).toBe(false);
    expect(payloadSchemas.timeline.safeParse({ events: [{ text: "x", time: "Dec 18" }] }).success).toBe(true);
  });
});

describe("folding", () => {
  it("folds stale widgets", () => {
    const w = widget("list", { items: [{ text: "a" }] }, { published_at: "2026-11-20T12:00:00Z", stale_after_hours: 48 });
    expect(isStale(w, NOW)).toBe(true);
    expect(foldReason(w, NOW, NY, TODAY)).toBe("stale");
  });
  it("folds a list with everything checked off", () => {
    expect(foldReason(widget("list", { items: [{ text: "a", done: true }] }), NOW, NY, TODAY)).toBe("done");
    expect(foldReason(widget("list", { items: [{ text: "a", done: true }, { text: "b" }] }), NOW, NY, TODAY)).toBeNull();
  });
  it("folds when every dated thing is behind us", () => {
    const past = widget("timeline", { events: [{ text: "a", at: "2026-11-20" }, { text: "b", at: "2026-11-27T08:00" }] });
    expect(foldReason(past, NOW, NY, TODAY)).toBe("past");
    const ahead = widget("timeline", { events: [{ text: "a", at: "2026-11-20" }, { text: "b", at: "2026-11-27T18:00" }] });
    expect(foldReason(ahead, NOW, NY, TODAY)).toBeNull();
    // Undated entries keep a digest open.
    expect(foldReason(widget("digest", { sections: [{ title: "", items: [{ text: "a" }] }] }), NOW, NY, TODAY)).toBeNull();
  });
  it("never folds built-in or unpublished widgets", () => {
    expect(foldReason(widget("tasks", {}), NOW, NY, TODAY)).toBeNull();
    expect(foldReason(widget("list", { items: [{ text: "a", done: true }] }, { published_at: null }), NOW, NY, TODAY)).toBeNull();
  });
});
