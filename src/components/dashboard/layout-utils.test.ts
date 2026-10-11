import { describe, expect, it } from "vitest";
import { groupPages, moveToPage, normalizeLayout, reorder } from "./layout-utils";

const w = (id: string, page: number, position: number) => ({ id, page, position, size: "m" as const });

describe("layout", () => {
  it("normalizes page gaps and positions", () => {
    const out = normalizeLayout([w("a", 2, 5), w("b", 0, 9), w("c", 2, 1)]);
    expect(out.map((x) => [x.id, x.page, x.position])).toEqual([
      ["b", 0, 0],
      ["c", 1, 0],
      ["a", 1, 1],
    ]);
  });
  it("reorders within a page", () => {
    const out = reorder([w("a", 0, 0), w("b", 0, 1), w("c", 0, 2)], "c", "a");
    expect(normalizeLayout(out).map((x) => x.id)).toEqual(["c", "a", "b"]);
  });
  it("ignores cross-page reorder", () => {
    const items = [w("a", 0, 0), w("b", 1, 0)];
    expect(reorder(items, "a", "b")).toBe(items);
  });
  it("moves to a new page and back", () => {
    const moved = moveToPage([w("a", 0, 0), w("b", 0, 1)], "a", 1);
    expect(groupPages(moved).map((p) => p.map((x) => x.id))).toEqual([["b"], ["a"]]);
    const back = moveToPage(moved, "a", 0);
    expect(groupPages(back).map((p) => p.map((x) => x.id))).toEqual([["b", "a"]]);
  });
});
