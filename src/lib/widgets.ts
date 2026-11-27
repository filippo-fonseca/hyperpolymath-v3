import { z } from "zod";

// Bot-supplied links: http(s) only, so a payload can never smuggle javascript: URLs.
const httpUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "only http(s) links");

// Widget kinds. Fixed kinds render live app data; custom kinds render a
// payload that a bot publishes. Shared by server validation and the UI.

export const FIXED_KINDS = ["tasks", "calendar", "habits", "capture", "kiwi", "projects"] as const;
export const CUSTOM_KINDS = ["digest", "list", "stat", "timeline", "markdown", "table"] as const;
export type FixedKind = (typeof FIXED_KINDS)[number];
export type CustomKind = (typeof CUSTOM_KINDS)[number];
export type WidgetKind = FixedKind | CustomKind;
export const WIDGET_SIZES = ["s", "m", "l", "w"] as const;
/** s = 1x1 unit, m = 2x1, l = 2x2, w = the full row (3 units tall on desktop, like l on phones). */
export type WidgetSize = (typeof WIDGET_SIZES)[number];

export const SIZE_LABELS: Record<WidgetSize, string> = { s: "Small", m: "Medium", l: "Large", w: "Wide" };

/** The size a new widget starts at when nobody picked one. */
export function defaultSizeFor(kind: WidgetKind): WidgetSize {
  switch (kind) {
    case "tasks":
    case "calendar":
    case "table":
      return "l";
    case "stat":
      return "s";
    default:
      return "m";
  }
}

export function asWidgetSize(s: string | null | undefined): WidgetSize {
  return (WIDGET_SIZES as readonly string[]).includes(s ?? "") ? (s as WidgetSize) : "m";
}

// A structured time: a date ("2026-11-30") or a date and time, with or without
// an offset ("2026-11-30T23:59", "2026-11-30T23:59:00-05:00"). The app shows
// it in the owner's timezone ("Mon 11:59pm", "Tomorrow"), so bots never have
// to format or convert times themselves. Without an offset it is the owner's
// local wall time.
export const WHEN_RE = /^\d{4}-\d{2}-\d{2}(T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const when = z
  .string()
  .regex(WHEN_RE, "use an ISO date or date-time")
  .refine((v) => !Number.isNaN(Date.parse(v.length === 10 ? `${v}T00:00:00Z` : v.replace(/(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?)$/, "$1Z"))), "not a real date");

const item = z.object({
  text: z.string().max(500),
  url: httpUrl.optional(),
  meta: z.string().max(120).optional().describe("small trailing label, e.g. a count or channel"),
  at: when.optional().describe("when it happens or is due; the app formats it"),
  done: z.boolean().optional(),
});

export const payloadSchemas = {
  digest: z.object({
    summary: z.string().max(1000).optional(),
    sections: z
      .array(z.object({ title: z.string().max(120), items: z.array(item).max(30) }))
      .max(12),
  }),
  list: z.object({ items: z.array(item).max(50) }),
  stat: z.object({
    value: z.union([z.string().max(40), z.number()]),
    label: z.string().max(80).optional(),
    delta: z.string().max(40).optional().describe('e.g. "+12%" or "-3"'),
    trend: z.array(z.number()).max(60).optional().describe("sparkline values, oldest first"),
  }),
  timeline: z.object({
    events: z
      .array(
        z
          .object({ time: z.string().max(40).optional(), at: when.optional(), text: z.string().max(300), url: httpUrl.optional() })
          .refine((e) => e.time || e.at, "give each event an at (preferred) or a time label"),
      )
      .max(50),
  }),
  markdown: z.object({ markdown: z.string().max(8000) }),
  table: z.object({
    columns: z.array(z.string().max(60)).min(1).max(8),
    rows: z.array(z.array(z.union([z.string().max(200), z.number(), z.null()]))).max(50),
  }),
} satisfies Record<CustomKind, z.ZodType>;

export type DigestPayload = z.infer<typeof payloadSchemas.digest>;
export type ListPayload = z.infer<typeof payloadSchemas.list>;
export type StatPayload = z.infer<typeof payloadSchemas.stat>;
export type TimelinePayload = z.infer<typeof payloadSchemas.timeline>;
export type MarkdownPayload = z.infer<typeof payloadSchemas.markdown>;
export type TablePayload = z.infer<typeof payloadSchemas.table>;

export function isCustomKind(k: string): k is CustomKind {
  return (CUSTOM_KINDS as readonly string[]).includes(k);
}

export const PAYLOAD_DOCS = `Payload shapes by kind:
- digest: { summary?, sections: [{ title, items: [{ text, url?, meta?, at? }] }] }
- list: { items: [{ text, url?, meta?, at?, done? }] }
- stat: { value, label?, delta?, trend?: number[] }
- timeline: { events: [{ at, text, url? }] }
- markdown: { markdown }
- table: { columns: string[], rows: (string|number|null)[][] }
at is an ISO date or date-time ("2026-11-30", "2026-11-30T23:59-05:00"); the app formats it in the owner's timezone, so keep times out of text and meta.`;

/**
 * Normalize a widget icon: an emoji (or a couple of characters), an https
 * image URL, or a website domain, which becomes that site's favicon.
 * Returns null to clear; throws on anything else.
 */
export function normalizeWidgetIcon(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (/^https:\/\//i.test(v)) {
    try {
      return new URL(v).toString();
    } catch {
      throw new Error("That icon URL isn't valid.");
    }
  }
  if (/^http:\/\//i.test(v)) throw new Error("Icon URLs must use https.");
  const domain = v.replace(/^www\./i, "").replace(/\/.*$/, "");
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(domain)) {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  }
  if ([...v].length <= 4) return v; // emoji or short glyph
  throw new Error("Use an emoji, an https image URL, or a website domain like slack.com.");
}

/** True when an icon value is an image URL (render <img>), otherwise text/emoji. */
export const isImageIcon = (icon: string | null | undefined) => !!icon && /^https:\/\//i.test(icon);
