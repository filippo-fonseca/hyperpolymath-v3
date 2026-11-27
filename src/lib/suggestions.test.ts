import { describe, expect, it } from "vitest";
import { dedupeKey, sourcesLabel } from "./suggestions";

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
  it("names one, two or many sources", () => {
    expect(sourcesLabel([])).toBe("your bots");
    expect(sourcesLabel(["Kiwi", "Kiwi"])).toBe("Kiwi");
    expect(sourcesLabel(["Kiwi", "Scout"])).toBe("Kiwi and Scout");
    expect(sourcesLabel(["Kiwi", "Scout", "Ada"])).toBe("Kiwi, Scout and 1 other");
    expect(sourcesLabel(["Kiwi", "Scout", "Ada", "Bo"])).toBe("Kiwi, Scout and 2 others");
  });
});
