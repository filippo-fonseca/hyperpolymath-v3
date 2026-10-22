// Todoist-style quick add: pull a due date, a time, a priority and a project
// out of a typed task title ("Call the bank tomorrow 5pm p1 #Admin"). Pure, so
// the composer can re-run it on every keystroke and tests can pin it down.

import { addDays, weekdayOf } from "./time";
import { WEEKDAYS_LONG } from "./format";

export type TokenKind = "date" | "time" | "priority" | "project";

export type ParsedToken = { kind: TokenKind; start: number; end: number; text: string };

export type QuickAdd = {
  /** The title with the parsed tokens taken out. */
  title: string;
  due_date?: string;
  /** "HH:MM", 24h. */
  due_time?: string;
  /** Stored scale: 3 is the highest (P1), 0 is none (P4). */
  priority?: number;
  project_id?: string;
  /** What was recognised, in text order, for highlighting. */
  tokens: ParsedToken[];
};

type Candidate = ParsedToken & { value: string | number };

// A token is a whole word: start of text or a space before it, and the end of
// text, a space or light punctuation after it.
const BEFORE = String.raw`(?<=^|\s)`;
const AFTER = String.raw`(?=$|[\s,.!?;:)])`;

const DATE_RE = new RegExp(`${BEFORE}(today|tomorrow|${WEEKDAYS_LONG.join("|")})${AFTER}`, "gi");
const TIME_12_RE = new RegExp(`${BEFORE}(?:at\\s+)?(\\d{1,2})(?::([0-5]\\d))?\\s?(am|pm)${AFTER}`, "gi");
// "5:30 pm" belongs to the 12h pattern, so the 24h one steps aside.
const TIME_24_RE = new RegExp(`${BEFORE}(?:at\\s+)?([01]?\\d|2[0-3]):([0-5]\\d)${AFTER}(?!\\s?[ap]m\\b)`, "gi");
const PRIORITY_RE = new RegExp(`${BEFORE}p([1-4])${AFTER}`, "gi");

const pad = (n: number) => String(n).padStart(2, "0");
const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** The date a word like "friday" means: the next one after today. */
function dateFor(word: string, today: string): string {
  const w = word.toLowerCase();
  if (w === "today") return today;
  if (w === "tomorrow") return addDays(today, 1);
  const target = WEEKDAYS_LONG.findIndex((d) => d.toLowerCase() === w);
  const ahead = (target - weekdayOf(today) + 7) % 7;
  return addDays(today, ahead === 0 ? 7 : ahead);
}

function projectAt(text: string, i: number, projects: { id: string; name: string }[]): Candidate | null {
  const rest = text.slice(i + 1);
  const lower = rest.toLowerCase();
  // Longest name first, so "#Side project" beats "#Side".
  const byLength = [...projects].sort((a, b) => b.name.length - a.name.length);
  for (const p of byLength) {
    const name = p.name.trim();
    if (!name || !lower.startsWith(name.toLowerCase())) continue;
    const next = rest[name.length];
    if (next === undefined || /[\s,.!?;:)]/.test(next)) {
      return { kind: "project", start: i, end: i + 1 + name.length, text: text.slice(i, i + 1 + name.length), value: p.id };
    }
  }
  // "#SideProject" or "#side-project" for a name with spaces.
  const word = /^\S+/.exec(rest)?.[0].replace(/[,.!?;:)]+$/, "");
  if (!word) return null;
  const hit = projects.find((p) => squash(p.name) && squash(p.name) === squash(word));
  return hit ? { kind: "project", start: i, end: i + 1 + word.length, text: `#${word}`, value: hit.id } : null;
}

export function parseQuickAdd(input: string, opts: { today: string; projects?: { id: string; name: string }[] }): QuickAdd {
  const found: Candidate[] = [];
  for (const m of input.matchAll(DATE_RE)) {
    found.push({ kind: "date", start: m.index, end: m.index + m[0].length, text: m[0], value: dateFor(m[1], opts.today) });
  }
  for (const m of input.matchAll(TIME_12_RE)) {
    const h = Number(m[1]);
    if (h < 1 || h > 12) continue;
    const h24 = (h % 12) + (m[3].toLowerCase() === "pm" ? 12 : 0);
    found.push({ kind: "time", start: m.index, end: m.index + m[0].length, text: m[0], value: `${pad(h24)}:${m[2] ?? "00"}` });
  }
  for (const m of input.matchAll(TIME_24_RE)) {
    found.push({ kind: "time", start: m.index, end: m.index + m[0].length, text: m[0], value: `${pad(Number(m[1]))}:${m[2]}` });
  }
  for (const m of input.matchAll(PRIORITY_RE)) {
    found.push({ kind: "priority", start: m.index, end: m.index + m[0].length, text: m[0], value: 4 - Number(m[1]) });
  }
  if (opts.projects?.length) {
    for (let i = input.indexOf("#"); i >= 0; i = input.indexOf("#", i + 1)) {
      if (i > 0 && !/\s/.test(input[i - 1])) continue;
      const c = projectAt(input, i, opts.projects);
      if (c) found.push(c);
    }
  }

  // The last mention of each kind wins, as when you correct yourself mid-type.
  const last = new Map<TokenKind, Candidate>();
  for (const c of found.sort((a, b) => a.start - b.start)) {
    const prev = last.get(c.kind);
    const overlaps = [...last.values()].some((o) => o !== prev && c.start < o.end && o.start < c.end);
    if (!overlaps) last.set(c.kind, c);
  }
  const kept = [...last.values()].sort((a, b) => a.start - b.start);

  let title = "";
  let at = 0;
  for (const t of kept) {
    title += input.slice(at, t.start);
    at = t.end;
  }
  title = (title + input.slice(at)).replace(/\s+/g, " ").trim();

  const out: QuickAdd = { title, tokens: kept.map(({ kind, start, end, text }) => ({ kind, start, end, text })) };
  for (const t of kept) {
    if (t.kind === "date") out.due_date = t.value as string;
    if (t.kind === "time") out.due_time = t.value as string;
    if (t.kind === "priority") out.priority = t.value as number;
    if (t.kind === "project") out.project_id = t.value as string;
  }
  return out;
}
