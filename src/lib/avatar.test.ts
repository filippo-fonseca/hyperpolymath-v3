import { describe, expect, it } from "vitest";
import { initialsOf, sniffImageType } from "./avatar";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("sniffImageType", () => {
  it("reads the real type from the first bytes", () => {
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("image/gif");
    expect(sniffImageType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe("image/webp");
  });

  it("rejects anything else, like SVG or HTML", () => {
    expect(sniffImageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<html>"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("initialsOf", () => {
  it("uses first and last words, or the email's name part", () => {
    expect(initialsOf("Ada Lovelace")).toBe("AL");
    expect(initialsOf("ada king lovelace")).toBe("AL");
    expect(initialsOf("ada@example.com")).toBe("A");
    expect(initialsOf("")).toBe("");
    expect(initialsOf(null)).toBe("");
  });
});
