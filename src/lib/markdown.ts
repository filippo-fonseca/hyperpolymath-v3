// A tiny, safe Markdown subset for bot-published widgets. Produces a plain
// tree that the UI renders as React elements, so raw HTML is never injected.
// Supported: # headings, paragraphs, - / * / 1. lists, > quotes, ``` code,
// ---, **bold**, *italic*, `code`, [links](https://...).

export type Inline =
  | { t: "text"; v: string }
  | { t: "b"; c: Inline[] }
  | { t: "i"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "a"; href: string; c: Inline[] };

export type Block =
  | { type: "h"; level: 1 | 2 | 3; c: Inline[] }
  | { type: "p"; c: Inline[] }
  | { type: "ul"; items: Inline[][] }
  | { type: "ol"; items: Inline[][] }
  | { type: "quote"; c: Inline[] }
  | { type: "code"; v: string }
  | { type: "hr" };

export function safeHref(url: string): string | null {
  const u = url.trim();
  return /^(https?:\/\/|mailto:)/i.test(u) ? u : null;
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ t: "text", v: text });
    text = "";
  };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^`([^`]+)`/))) {
      flush();
      out.push({ t: "code", v: m[1] });
    } else if ((m = rest.match(/^\*\*(.+?)\*\*/)) || (m = rest.match(/^__(.+?)__/))) {
      flush();
      out.push({ t: "b", c: parseInline(m[1]) });
    } else if ((m = rest.match(/^\*([^*\s][^*]*?)\*/)) || (m = rest.match(/^_([^_\s][^_]*?)_(?![A-Za-z0-9])/))) {
      flush();
      out.push({ t: "i", c: parseInline(m[1]) });
    } else if ((m = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/))) {
      const href = safeHref(m[2]);
      flush();
      if (href) out.push({ t: "a", href, c: parseInline(m[1]) });
      else out.push(...parseInline(m[1]));
    } else {
      text += src[i];
      i++;
      continue;
    }
    i += m[0].length;
  }
  flush();
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", c: parseInline(para.join(" ")) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      continue;
    }
    if (trimmed.startsWith("```")) {
      flushPara();
      const body: string[] = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith("```"); i++) body.push(lines[i]);
      blocks.push({ type: "code", v: body.join("\n") });
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = trimmed.match(/^(#{1,6})\s+(.*)$/))) {
      flushPara();
      blocks.push({ type: "h", level: Math.min(3, m[1].length) as 1 | 2 | 3, c: parseInline(m[2]) });
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushPara();
      blocks.push({ type: "hr" });
    } else if (/^[-*+]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      flushPara();
      const ordered = /^\d/.test(trimmed);
      const re = ordered ? /^\d+[.)]\s+(.*)$/ : /^[-*+]\s+(.*)$/;
      const items: Inline[][] = [];
      for (; i < lines.length; i++) {
        const mm = lines[i].trim().match(re);
        if (!mm) break;
        items.push(parseInline(mm[1]));
      }
      i--;
      blocks.push(ordered ? { type: "ol", items } : { type: "ul", items });
    } else if (trimmed.startsWith(">")) {
      flushPara();
      const body: string[] = [];
      for (; i < lines.length && lines[i].trim().startsWith(">"); i++) body.push(lines[i].trim().replace(/^>\s?/, ""));
      i--;
      blocks.push({ type: "quote", c: parseInline(body.join(" ")) });
    } else {
      para.push(trimmed);
    }
  }
  flushPara();
  return blocks;
}
