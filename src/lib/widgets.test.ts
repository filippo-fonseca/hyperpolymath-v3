import { describe, expect, it } from "vitest";
import { CUSTOM_KINDS, KIND_INFO, kindSchemas, payloadSchemas, validatePayload } from "./widgets";

describe("widget kinds", () => {
  it("every catalog example is a valid payload", () => {
    for (const k of CUSTOM_KINDS) {
      const r = payloadSchemas[k].safeParse(KIND_INFO[k].example);
      expect(r.success, `${k}: ${r.success ? "" : JSON.stringify(r.error.issues)}`).toBe(true);
    }
  });

  it("generates a JSON schema per kind", () => {
    const all = kindSchemas();
    expect(Object.keys(all)).toEqual([...CUSTOM_KINDS]);
    const line = kindSchemas("line").line;
    expect(JSON.stringify(line.schema)).toContain("series");
  });

  it("rejects javascript: links and bad times", () => {
    expect(validatePayload("list", { items: [{ text: "x", url: "javascript:alert(1)" }] }).ok).toBe(false);
    expect(validatePayload("list", { items: [{ text: "x", at: "tomorrow" }] }).ok).toBe(false);
    expect(validatePayload("list", { items: [{ text: "x", at: "2026-11-28" }] }).ok).toBe(true);
    expect(validatePayload("list", { items: [{ text: "x", at: "2026-11-28T09:00:00+01:00" }] }).ok).toBe(true);
  });

  it("timeline events need a time or an at", () => {
    expect(validatePayload("timeline", { events: [{ text: "x" }] }).ok).toBe(false);
    expect(validatePayload("timeline", { events: [{ text: "x", time: "9am" }] }).ok).toBe(true);
  });

  it("blocks validate the kind they embed", () => {
    expect(validatePayload("blocks", { blocks: [{ kind: "stat", data: { value: 3 } }] }).ok).toBe(true);
    expect(validatePayload("blocks", { blocks: [{ kind: "stat", data: { nope: 3 } }] }).ok).toBe(false);
    expect(validatePayload("blocks", { blocks: [{ kind: "blocks", data: {} }] }).ok).toBe(false);
  });
});
