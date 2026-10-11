import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "./markdown";

describe("markdown subset", () => {
  it("parses headings, lists and paragraphs", () => {
    const b = parseMarkdown("# Title\n\nHello\nworld\n\n- a\n- b\n\n1. one\n2. two");
    expect(b.map((x) => x.type)).toEqual(["h", "p", "ul", "ol"]);
    expect(b[1]).toEqual({ type: "p", c: [{ t: "text", v: "Hello world" }] });
  });

  it("parses inline formatting", () => {
    expect(parseInline("**bold** and *it* `x`")).toEqual([
      { t: "b", c: [{ t: "text", v: "bold" }] },
      { t: "text", v: " and " },
      { t: "i", c: [{ t: "text", v: "it" }] },
      { t: "text", v: " " },
      { t: "code", v: "x" },
    ]);
  });

  it("keeps only safe link targets", () => {
    expect(parseInline("[ok](https://a.com)")[0]).toMatchObject({ t: "a", href: "https://a.com" });
    expect(parseInline("[bad](javascript:alert(1))")).toEqual([{ t: "text", v: "bad" }, { t: "text", v: ")" }]);
    expect(parseInline("[mail](mailto:a@b.co)")).toEqual([{ t: "text", v: "mail" }]);
  });

  it("treats html as text", () => {
    expect(parseMarkdown("<script>alert(1)</script>")).toEqual([
      { type: "p", c: [{ t: "text", v: "<script>alert(1)</script>" }] },
    ]);
  });

  it("parses fenced code and quotes", () => {
    const b = parseMarkdown("```\nconst a = 1\n```\n> quoted\n> more");
    expect(b).toEqual([
      { type: "code", v: "const a = 1" },
      { type: "quote", c: [{ t: "text", v: "quoted more" }] },
    ]);
  });
});
