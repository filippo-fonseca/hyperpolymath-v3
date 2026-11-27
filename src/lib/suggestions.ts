// Pure helpers for bot suggestions (client-safe, no I/O).

/** How many suggestions one source (a bot, or an /api/suggest caller) may make in 24 hours. */
export const DAILY_LIMIT_PER_SOURCE = 25;
/** How many can wait in the tray at once, so a runaway bot can't bury the owner. */
export const PENDING_LIMIT = 100;
/** A dismissed suggestion isn't offered again for this many days. */
export const DISMISS_MEMORY_DAYS = 30;
/** Most items one suggest call takes (batching keeps routine runs to one call). */
export const BATCH_LIMIT = 10;

/**
 * The same thing, phrased the same way give or take case, punctuation,
 * whitespace and a leading "todo:"-style prefix, gets the same key.
 */
export function dedupeKey(content: string): string {
  return content
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^\s*(?:todo|task|idea|note|reminder|capture)\s*[:\-–]\s*/, "")
    .replace(/https?:\/\/(?:www\.)?/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 300);
}

export type SuggestionOutcome = "pending" | "duplicate" | "exists" | "dismissed_before";

/** Who suggested, most frequent first: "Kiwi", "Kiwi and Scout", "Kiwi, Scout and Ada", "Kiwi, Scout and 2 others". */
export function sourcesLabel(names: string[]): string {
  const counts = new Map<string, number>();
  for (const n of names) if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
  const unique = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)!);
  if (unique.length <= 1) return unique[0] ?? "your bots";
  if (unique.length <= 3) return `${unique.slice(0, -1).join(", ")} and ${unique.at(-1)}`;
  const rest = unique.length - 2;
  return `${unique[0]}, ${unique[1]} and ${rest} others`;
}

/**
 * Tray order: what's due soonest (overdue and today first), then higher
 * priority, then newest. Undated suggestions follow the dated ones.
 */
export function bySuggestionUrgency<T extends { due_date: string | null; priority: number; created_at: string }>(a: T, b: T): number {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  if (a.priority !== b.priority) return b.priority - a.priority;
  return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
}
