import { describe, expect, it } from "vitest";
import { MIN_CARD_H, ROW_UNIT, asWidgetSize, cardHeight, cellSize, groupPages, moveToPage, nominalHeight, normalizeLayout, reorder, rowSpan } from "./layout-utils";
import { defaultSizeFor } from "@/lib/widgets";

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

describe("sizes", () => {
  it("accepts the four sizes and falls back to medium", () => {
    expect(["s", "m", "l", "w", "xl", ""].map(asWidgetSize)).toEqual(["s", "m", "l", "w", "m", "m"]);
  });
  it("picks a default per kind", () => {
    expect(defaultSizeFor("tasks")).toBe("l");
    expect(defaultSizeFor("stat")).toBe("s");
    expect(defaultSizeFor("digest")).toBe("m");
  });
});

describe("card heights", () => {
  // Desktop: 8 columns, 24px gap, 1120px wide, so a cell is 119px.
  const m = { width: 1120, cols: 8, gap: 24 };
  it("gives each size its box", () => {
    expect(cellSize(m)).toBe(119);
    expect(nominalHeight("s", m)).toBe(262);
    expect(nominalHeight("l", m)).toBe(548);
    expect(nominalHeight("w", m)).toBe(405);
    expect(nominalHeight("w", { ...m, cols: 4 })).toBe(nominalHeight("l", { ...m, cols: 4 }));
  });
  it("sizes to content between a floor and the box", () => {
    expect(cardHeight("m", m, null)).toBe(262);
    expect(cardHeight("m", m, 150)).toBe(150);
    expect(cardHeight("m", m, 900)).toBe(262);
    expect(cardHeight("m", m, 40)).toBe(MIN_CARD_H);
    expect(cardHeight("m", m, 56, true)).toBe(56);
  });
  it("spans enough fine rows for the height and the gap", () => {
    expect(rowSpan(150, 24)).toBe(Math.ceil(174 / ROW_UNIT));
  });
});
