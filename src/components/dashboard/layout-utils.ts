import type { WidgetSize } from "@/lib/widgets";

export type LayoutItem = { id: string; page: number; position: number; size: WidgetSize };

/** Sort by page then position, close page gaps and renumber positions. */
export function normalizeLayout<T extends LayoutItem>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => a.page - b.page || a.position - b.position);
  const pages = [...new Set(sorted.map((w) => w.page))];
  const pageIndex = new Map(pages.map((p, i) => [p, i]));
  const counters = new Map<number, number>();
  return sorted.map((w) => {
    const page = pageIndex.get(w.page)!;
    const position = counters.get(page) ?? 0;
    counters.set(page, position + 1);
    return { ...w, page, position };
  });
}

export function groupPages<T extends LayoutItem>(items: T[]): T[][] {
  const pages: T[][] = [];
  for (const w of items) (pages[w.page] ??= []).push(w);
  return pages.map((p) => p ?? []);
}

/** Move `id` to sit where `overId` is within the same page. */
export function reorder<T extends LayoutItem>(items: T[], id: string, overId: string): T[] {
  const a = items.find((w) => w.id === id);
  const b = items.find((w) => w.id === overId);
  if (!a || !b || a.page !== b.page || a.id === b.id) return items;
  const page = items.filter((w) => w.page === a.page).sort((x, y) => x.position - y.position);
  const from = page.findIndex((w) => w.id === id);
  const to = page.findIndex((w) => w.id === overId);
  const moved = [...page];
  const [it] = moved.splice(from, 1);
  moved.splice(to, 0, it);
  const pos = new Map(moved.map((w, i) => [w.id, i]));
  return items.map((w) => (pos.has(w.id) ? { ...w, position: pos.get(w.id)! } : w));
}

/** Move a widget to the end of another page (or a new one). */
export function moveToPage<T extends LayoutItem>(items: T[], id: string, page: number): T[] {
  const last = Math.max(-1, ...items.filter((w) => w.page === page && w.id !== id).map((w) => w.position));
  return normalizeLayout(items.map((w) => (w.id === id ? { ...w, page, position: last + 1 } : w)));
}

export { asWidgetSize } from "@/lib/widgets";

// Card heights. The grid's columns are fixed (4 / 6 / 8 by breakpoint) and a
// size sets how many a card spans. Heights are free: the grid runs on fine
// ROW_UNIT rows with no row gap, and every card spans enough rows for its
// height plus the gap. A size's nominal height (S and M two square cells,
// L four, W three on desktop) is the most a card can take; widgets that
// report their content height get a shorter card when they need less.

export const ROW_UNIT = 4;
/** The shortest a content-sized card gets: a header and one line. */
export const MIN_CARD_H = 84;

export type GridMetrics = { width: number; cols: number; gap: number };

export function cellSize(m: GridMetrics): number {
  return (m.width - (m.cols - 1) * m.gap) / m.cols;
}

/** Height of a size's full box, in px. */
export function nominalHeight(size: WidgetSize, m: GridMetrics): number {
  const cells = size === "l" ? 4 : size === "w" ? (m.cols >= 8 ? 3 : 4) : 2;
  return cells * cellSize(m) + (cells - 1) * m.gap;
}

/**
 * The card's height: its size's box, or the content's own height when the
 * widget reported one, never past the box. `natural` below MIN_CARD_H only
 * comes from collapsed cards, which are allowed to be a single strip.
 */
export function cardHeight(size: WidgetSize, m: GridMetrics, natural: number | null, collapsed = false): number {
  const max = nominalHeight(size, m);
  if (natural == null) return Math.round(max);
  const min = collapsed ? 0 : Math.min(MIN_CARD_H, max);
  return Math.round(Math.min(max, Math.max(min, natural)));
}

/** Grid rows a card of `height` spans, leaving the gap below it. */
export function rowSpan(height: number, gap: number): number {
  return Math.max(1, Math.ceil((height + gap) / ROW_UNIT));
}
