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
export type WidgetSize = "s" | "m" | "l";

const item = z.object({
  text: z.string().max(500),
  url: httpUrl.optional(),
  meta: z.string().max(120).optional().describe("small trailing label, e.g. a time, count or channel"),
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
      .array(z.object({ time: z.string().max(40), text: z.string().max(300), url: httpUrl.optional() }))
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
- digest: { summary?, sections: [{ title, items: [{ text, url?, meta? }] }] }
- list: { items: [{ text, url?, meta?, done? }] }
- stat: { value, label?, delta?, trend?: number[] }
- timeline: { events: [{ time, text, url? }] }
- markdown: { markdown }
- table: { columns: string[], rows: (string|number|null)[][] }`;
