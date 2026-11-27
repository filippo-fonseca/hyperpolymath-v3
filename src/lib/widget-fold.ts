// When a custom widget folds to a single strip on the dashboard: it has gone
// stale (its bot stopped publishing), everything in it is checked off, or
// every dated thing in it is behind us. Folded cards sink to the end of their
// page, so what is current leads. Pure, so it is shared and tested.

import { isCustomKind, payloadSchemas } from "./widgets";
import { parseWhen, whenIsPast } from "./format";

export type FoldReason = "stale" | "done" | "past";

type Foldable = { kind: string; payload: unknown; published_at: string | null; stale_after_hours: number | null; source?: unknown };

export function isStale(w: Pick<Foldable, "published_at" | "stale_after_hours"> & { source?: unknown }, nowMs: number): boolean {
  // Live widgets are filled by the app on read, so they never go stale.
  if (w.source || !w.published_at || !w.stale_after_hours) return false;
  return nowMs - Date.parse(w.published_at) > w.stale_after_hours * 3_600_000;
}

export function foldReason(w: Foldable, nowMs: number, tz: string, today: string): FoldReason | null {
  if (!isCustomKind(w.kind) || !w.published_at) return null;
  if (isStale(w, nowMs)) return "stale";
  const past = (at: string | undefined) => {
    const t = parseWhen(at, tz);
    return !!t && whenIsPast(t, nowMs, today);
  };
  switch (w.kind) {
    case "list": {
      const p = payloadSchemas.list.safeParse(w.payload);
      if (!p.success || p.data.items.length === 0) return null;
      if (p.data.items.every((it) => it.done)) return "done";
      return p.data.items.every((it) => it.done || past(it.at)) ? "past" : null;
    }
    case "digest": {
      const p = payloadSchemas.digest.safeParse(w.payload);
      const items = p.success ? p.data.sections.flatMap((s) => s.items) : [];
      return items.length > 0 && items.every((it) => past(it.at)) ? "past" : null;
    }
    case "timeline": {
      const p = payloadSchemas.timeline.safeParse(w.payload);
      return p.success && p.data.events.length > 0 && p.data.events.every((e) => past(e.at)) ? "past" : null;
    }
    default:
      return null;
  }
}

export const FOLD_LABELS: Record<FoldReason | "manual", string> = {
  stale: "Stale",
  done: "All done",
  past: "Nothing ahead",
  manual: "Collapsed",
};
