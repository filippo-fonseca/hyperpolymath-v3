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
