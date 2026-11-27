import { describe, expect, it } from "vitest";
import { bySuggestionUrgency, dedupeKey, sourcesLabel } from "./suggestions";

describe("dedupeKey", () => {
  it("ignores case, punctuation and spacing", () => {
    expect(dedupeKey("Email Prof. Lee about the PSET!")).toBe(dedupeKey("  email prof lee   about the pset "));
  });

  it("drops a leading todo-style prefix", () => {
    expect(dedupeKey("TODO: renew passport")).toBe(dedupeKey("Renew passport"));
    expect(dedupeKey("Idea - heart-rate widget")).toBe(dedupeKey("heart rate widget"));
  });

  it("folds accents and URL schemes", () => {
    expect(dedupeKey("Café at https://www.example.com/x")).toBe(dedupeKey("cafe at example.com/x"));
  });

  it("keeps different things apart", () => {
    expect(dedupeKey("Book flight to Rome")).not.toBe(dedupeKey("Book flight to San José"));
  });

  it("keeps non-Latin text", () => {
    expect(dedupeKey("買い物")).toBe("買い物");
  });
});

describe("sourcesLabel", () => {
  it("names up to three sources, most frequent first", () => {
    expect(sourcesLabel([])).toBe("your bots");
    expect(sourcesLabel(["Kiwi", "Kiwi"])).toBe("Kiwi");
    expect(sourcesLabel(["Scout", "Kiwi", "Kiwi"])).toBe("Kiwi and Scout");
    expect(sourcesLabel(["Kiwi", "Scout", "Ada"])).toBe("Kiwi, Scout and Ada");
    expect(sourcesLabel(["Kiwi", "Scout", "Ada", "Bo"])).toBe("Kiwi, Scout and 2 others");
  });
});

describe("bySuggestionUrgency", () => {
  const s = (id: string, due_date: string | null, priority = 0, created_at = "2026-11-27T10:00:00Z") => ({ id, due_date, priority, created_at });
  it("puts the soonest due first, then priority, then newest, undated last", () => {
    const list = [
      s("undated-old", null, 0, "2026-11-26T10:00:00Z"),
      s("undated-new", null, 0, "2026-11-27T11:00:00Z"),
      s("sunday", "2026-11-29"),
      s("today-low", "2026-11-27", 1),
      s("today-high", "2026-11-27", 3),
      s("undated-high", null, 3),
    ];
    expect([...list].sort(bySuggestionUrgency).map((x) => x.id)).toEqual([
      "today-high",
      "today-low",
      "sunday",
      "undated-high",
      "undated-new",
      "undated-old",
    ]);
  });
});
