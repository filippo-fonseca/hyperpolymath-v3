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

/** "Kiwi", "Kiwi and Scout", "Kiwi, Scout and 2 others". */
export function sourcesLabel(names: string[]): string {
  const unique = [...new Set(names.filter(Boolean))];
  if (unique.length <= 1) return unique[0] ?? "your bots";
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  const rest = unique.length - 2;
  return `${unique[0]}, ${unique[1]} and ${rest} other${rest === 1 ? "" : "s"}`;
}
