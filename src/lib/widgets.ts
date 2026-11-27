import { z } from "zod";

// Bot-supplied links: http(s) only, so a payload can never smuggle javascript: URLs.
const httpUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "only http(s) links");

// Widget kinds. Fixed kinds render live app data; custom kinds render a
// payload that a bot publishes. Shared by server validation and the UI.

export const FIXED_KINDS = ["tasks", "calendar", "habits", "capture", "kiwi", "projects"] as const;
export const CUSTOM_KINDS = [
  "digest",
  "list",
  "stat",
  "timeline",
  "markdown",
  "table",
  "line",
  "bar",
  "donut",
  "progress",
  "heatmap",
  "blocks",
] as const;
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
    case "blocks":
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

// Shared building blocks ------------------------------------------------------
// Bots pick from a small, named palette rather than raw colors, so every
// widget stays on brand and readable.

export const ACCENTS = ["blue", "green", "red", "orange", "yellow", "purple", "pink", "teal", "gray"] as const;
export type Accent = (typeof ACCENTS)[number];
const accent = z.enum(ACCENTS);

export const TONES = ["positive", "negative", "warning", "neutral"] as const;
export type Tone = (typeof TONES)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// A date, or a date and time with or without an offset. Without an offset it
// is the owner's local wall time ("2026-11-30T23:59").
export const WHEN_RE = /^\d{4}-\d{2}-\d{2}(T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const realDate = (v: string) => !Number.isNaN(Date.parse(v.length === 10 ? `${v}T00:00:00Z` : v.replace(/(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?)$/, "$1Z")));

/**
 * A structured moment: a date ("2026-11-28") or a date-time, with an offset
 * ("2026-11-27T15:30:00Z") or without one (the owner's wall clock). The app
 * formats it in the owner's timezone and keeps it relative ("in 2h",
 * "Tomorrow 9:30am"), so bots never format or convert times.
 */
export const at = z
  .string()
  .max(40)
  .refine((s) => WHEN_RE.test(s) && realDate(s), "ISO date or date-time")
  .describe('When: a date ("2026-11-28") or ISO date-time ("2026-11-27T15:30:00Z"; no offset = owner\'s local time). The app formats it.');

const emoji = z.string().max(16).refine((s) => [...s].length <= 4, "an emoji or up to 4 characters");
const shortText = (n: number) => z.string().max(n);
const num = z.number().finite();

/** Common, optional presentation fields every custom payload accepts. */
const common = {
  accent: accent.optional().describe("Theme color for charts and highlights"),
  footnote: shortText(200).optional().describe('Small print under the content, e.g. "Source: Strava"'),
};

const item = z.object({
  text: shortText(500),
  url: httpUrl.optional(),
  meta: shortText(120).optional().describe("small trailing label, e.g. a count or channel"),
  at: at.optional(),
  done: z.boolean().optional(),
  icon: emoji.optional(),
  badge: shortText(24).optional().describe("short pill, e.g. NEW or 3"),
  tone: z.enum(TONES).optional(),
});

/** X axis for line and bar charts: explicit labels, or a start date and a step the app labels itself. */
const axis = {
  labels: z.array(shortText(40)).max(400).optional().describe("One label per point"),
  start: z.string().regex(ISO_DATE).optional().describe("Instead of labels: date of the first point, YYYY-MM-DD"),
  step: z.enum(["day", "week", "month"]).optional().describe("Spacing between points when start is given (default day)"),
  unit: shortText(16).optional().describe('Value unit, e.g. "h", "%", "km"'),
};

const series = z.object({
  name: shortText(40),
  values: z.array(num.nullable()).min(1).max(400),
  color: accent.optional(),
});

const baseSchemas = {
  digest: z.object({
    summary: shortText(1000).optional(),
    sections: z.array(z.object({ title: shortText(120), items: z.array(item).max(30) })).max(12),
    ...common,
  }),
  list: z.object({ items: z.array(item).max(50), ...common }),
  stat: z.object({
    value: z.union([shortText(40), num]),
    label: shortText(80).optional(),
    prefix: shortText(4).optional().describe('e.g. "$"'),
    unit: shortText(12).optional().describe('e.g. "km" or "%"'),
    delta: shortText(40).optional().describe('e.g. "+12%" or "-3"'),
    good: z.enum(["up", "down"]).optional().describe("Which direction of delta is good (default up)"),
    target: num.optional().describe("Goal for a numeric value; shows a progress bar"),
    trend: z.array(num).max(60).optional().describe("sparkline values, oldest first"),
    at: at.optional().describe("As of when"),
    ...common,
  }),
  timeline: z.object({
    events: z
      .array(
        z
          .object({ time: shortText(40).optional(), at: at.optional(), text: shortText(300), url: httpUrl.optional(), icon: emoji.optional(), tone: z.enum(TONES).optional() })
          .refine((e) => e.time || e.at, "each event needs time or at"),
      )
      .max(50),
    ...common,
  }),
  markdown: z.object({ markdown: shortText(8000), ...common }),
  table: z.object({
    columns: z.array(shortText(60)).min(1).max(8),
    rows: z.array(z.array(z.union([shortText(200), num, z.null()]))).max(50),
    ...common,
  }),
  line: z
    .object({
      series: z.array(series).min(1).max(6),
      ...axis,
      area: z.boolean().optional().describe("Fill under the line (default true for one series)"),
      goal: z.object({ value: num, label: shortText(40).optional() }).optional().describe("Dashed reference line"),
      summary: z.object({ value: z.union([shortText(40), num]), label: shortText(60).optional(), delta: shortText(40).optional() }).optional(),
      ...common,
    })
    .refine((p) => p.series.every((s) => !p.labels || s.values.length <= p.labels.length), "labels must cover every value"),
  bar: z.object({
    series: z.array(series).min(1).max(6),
    ...axis,
    stacked: z.boolean().optional(),
    horizontal: z.boolean().optional().describe("Horizontal bars, best for ranked categories with long names"),
    goal: z.object({ value: num, label: shortText(40).optional() }).optional(),
    ...common,
  }),
  donut: z.object({
    segments: z.array(z.object({ label: shortText(40), value: num.min(0), color: accent.optional() })).min(1).max(12),
    center: z.object({ value: z.union([shortText(20), num]), label: shortText(30).optional() }).optional(),
    unit: shortText(16).optional(),
    ...common,
  }),
  progress: z.object({
    items: z
      .array(z.object({ label: shortText(60), value: num, target: num.positive(), unit: shortText(16).optional(), color: accent.optional(), icon: emoji.optional() }))
      .min(1)
      .max(8),
    style: z.enum(["rings", "bars"]).optional().describe("rings (default up to 4 items) or bars"),
    ...common,
  }),
  heatmap: z.object({
    start: z.string().regex(ISO_DATE).describe("Date of the first value, YYYY-MM-DD"),
    values: z.array(num.min(0).nullable()).min(1).max(400).describe("One value per day from start; null = no data"),
    max: num.positive().optional().describe("Value that gets the darkest cell (default the largest value)"),
    label: shortText(60).optional().describe('What a value means, e.g. "workouts"'),
    ...common,
  }),
};

/** Kinds a blocks widget can embed. */
export const BLOCK_KINDS = ["stat", "list", "line", "bar", "donut", "progress", "heatmap", "markdown", "timeline", "table"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

const blockOf = <K extends BlockKind>(k: K) =>
  z.object({
    kind: z.literal(k),
    title: shortText(60).optional(),
    span: z.union([z.literal(1), z.literal(2)]).optional().describe("2 = full width of the widget"),
    data: baseSchemas[k],
  });

const block = z.discriminatedUnion("kind", [
  blockOf("stat"),
  blockOf("list"),
  blockOf("line"),
  blockOf("bar"),
  blockOf("donut"),
  blockOf("progress"),
  blockOf("heatmap"),
  blockOf("markdown"),
  blockOf("timeline"),
  blockOf("table"),
]);

export const payloadSchemas = {
  ...baseSchemas,
  blocks: z.object({
    blocks: z.array(block).min(1).max(6).describe("A small layout of other kinds, two per row"),
    ...common,
  }),
} satisfies Record<CustomKind, z.ZodType>;

export type DigestPayload = z.infer<typeof payloadSchemas.digest>;
export type ListPayload = z.infer<typeof payloadSchemas.list>;
export type ListItem = z.infer<typeof item>;
export type StatPayload = z.infer<typeof payloadSchemas.stat>;
export type TimelinePayload = z.infer<typeof payloadSchemas.timeline>;
export type MarkdownPayload = z.infer<typeof payloadSchemas.markdown>;
export type TablePayload = z.infer<typeof payloadSchemas.table>;
export type LinePayload = z.infer<typeof payloadSchemas.line>;
export type BarPayload = z.infer<typeof payloadSchemas.bar>;
export type DonutPayload = z.infer<typeof payloadSchemas.donut>;
export type ProgressPayload = z.infer<typeof payloadSchemas.progress>;
export type HeatmapPayload = z.infer<typeof payloadSchemas.heatmap>;
export type BlocksPayload = z.infer<typeof payloadSchemas.blocks>;
export type Block = BlocksPayload["blocks"][number];

export function isCustomKind(k: string): k is CustomKind {
  return (CUSTOM_KINDS as readonly string[]).includes(k);
}

/** Validate a payload for a kind; errors read well in a tool result or a form. */
export function validatePayload(kind: CustomKind, payload: unknown): { ok: true; data: unknown } | { ok: false; error: string } {
  const r = payloadSchemas[kind].safeParse(payload);
  if (r.success) return { ok: true, data: r.data };
  const issues = r.error.issues.slice(0, 6).map((i) => `${i.path.join(".") || "payload"}: ${i.message}`);
  return { ok: false, error: issues.join("; ") };
}

/** The kind a payload fits, preferring `kind` (old snapshots don't record theirs). */
export function inferKind(payload: unknown, kind: CustomKind): CustomKind {
  if (payloadSchemas[kind].safeParse(payload).success) return kind;
  return CUSTOM_KINDS.find((k) => payloadSchemas[k].safeParse(payload).success) ?? kind;
}

// The catalog: what each kind is for, when to use it, and a working example.
// The builder's gallery and the widget_kinds MCP tool both read this, so the
// app and the bots always agree on what a kind looks like.

export type KindInfo = {
  label: string;
  blurb: string;
  /** When a bot should reach for it. */
  use: string;
  group: "text" | "chart" | "layout";
  example: unknown;
};

const day = (offset: number) => {
  const d = new Date(Date.UTC(2026, 10, 27 + offset));
  return d.toISOString().slice(0, 10);
};

export const KIND_INFO: Record<CustomKind, KindInfo> = {
  digest: {
    label: "Digest",
    blurb: "Sections of items, like an inbox or Slack roundup.",
    use: "A roundup grouped by source or channel.",
    group: "text",
    example: {
      summary: "Two replies need you today. Everything else can wait.",
      sections: [
        {
          title: "Needs a reply",
          items: [
            { text: "Prof. Lee: lab report extension approved", meta: "email", icon: "✉️", tone: "positive" },
            { text: "Design review moved to Thursday", at: "2026-11-27T14:05:00Z", badge: "NEW" },
          ],
        },
        { title: "FYI", items: [{ text: "Robotics club meets at 7pm in Becton", meta: "#robotics" }] },
      ],
    },
  },
  list: {
    label: "List",
    blurb: "A checklist or reading list, with icons and badges.",
    use: "Short actionable items, links to read, a packing list.",
    group: "text",
    example: {
      items: [
        { text: "Read: Attention Is All You Need", url: "https://arxiv.org/abs/1706.03762", icon: "📄" },
        { text: "Book flights home", done: true },
        { text: "Problem set 7", at: "2026-11-28", badge: "due", tone: "warning" },
      ],
    },
  },
  stat: {
    label: "Number",
    blurb: "One big number with a trend, delta or goal.",
    use: "A single metric worth glancing at.",
    group: "chart",
    example: { value: 42.5, unit: "km", label: "Run this week", delta: "+8.1", target: 50, trend: [21, 30, 26, 35, 38, 34, 42.5], accent: "green" },
  },
  timeline: {
    label: "Timeline",
    blurb: "Timestamped events, newest last.",
    use: "What happened, or what's coming, in order.",
    group: "text",
    example: {
      events: [
        { at: "2026-11-27T13:00:00Z", text: "Deployed v3.1 to production", icon: "🚀", tone: "positive" },
        { at: "2026-11-27T15:30:00Z", text: "Team sync" },
        { time: "Tonight", text: "Pack for the trip" },
      ],
    },
  },
  markdown: {
    label: "Note",
    blurb: "Free-form markdown.",
    use: "Anything prose: a briefing, a quote, a plan.",
    group: "text",
    example: { markdown: "**Focus this week**\n\n- Finish the thermo lab\n- Two runs and one swim\n- Call Nonna on Sunday" },
  },
  table: {
    label: "Table",
    blurb: "Rows and columns.",
    use: "Comparisons and structured records.",
    group: "text",
    example: {
      columns: ["Course", "Grade", "Next due"],
      rows: [
        ["ENAS 130", "A-", "Mon"],
        ["CPSC 223", "A", "Wed"],
        ["MENG 285", "B+", "Fri"],
      ],
    },
  },
  line: {
    label: "Line chart",
    blurb: "One or more values over time.",
    use: "Trends: weight, sleep, spending, anything daily or weekly.",
    group: "chart",
    example: {
      series: [{ name: "Sleep", values: [7.1, 6.4, 7.8, 8.2, 6.9, 7.5, 8.0, 7.2, 6.8, 7.9, 8.4, 7.7, 7.3, 8.1] }],
      start: day(-13),
      step: "day",
      unit: "h",
      goal: { value: 8, label: "Goal" },
      summary: { value: "7.5h", label: "average", delta: "+0.4h" },
      accent: "purple",
    },
  },
  bar: {
    label: "Bar chart",
    blurb: "Compare amounts, stacked or side by side.",
    use: "Totals per day or per category, rankings.",
    group: "chart",
    example: {
      series: [
        { name: "Deep work", values: [3, 4.5, 2, 5, 3.5, 1, 0.5] },
        { name: "Meetings", values: [1, 0.5, 2.5, 1, 1.5, 0, 0] },
      ],
      start: day(-6),
      step: "day",
      unit: "h",
      stacked: true,
    },
  },
  donut: {
    label: "Donut",
    blurb: "Parts of a whole.",
    use: "Where time or money went, shares of a total.",
    group: "chart",
    example: {
      segments: [
        { label: "School", value: 18 },
        { label: "Research", value: 9 },
        { label: "Training", value: 6 },
        { label: "Life", value: 4 },
      ],
      center: { value: 37, label: "hours" },
      unit: "h",
    },
  },
  progress: {
    label: "Progress",
    blurb: "Rings or bars toward goals.",
    use: "Goals with a target: steps, pages, savings, fundraising.",
    group: "chart",
    example: {
      items: [
        { label: "Swim", value: 3.2, target: 5, unit: "km", icon: "🏊", color: "teal" },
        { label: "Bike", value: 110, target: 150, unit: "km", icon: "🚴", color: "orange" },
        { label: "Run", value: 31, target: 30, unit: "km", icon: "🏃", color: "green" },
      ],
      style: "rings",
    },
  },
  heatmap: {
    label: "Heatmap",
    blurb: "A calendar of daily intensity.",
    use: "Consistency over weeks or months.",
    group: "chart",
    example: {
      start: day(-118),
      values: Array.from({ length: 119 }, (_, i) => ((i * 7919) % 11 > 3 ? ((i * 31) % 5) : 0)),
      label: "workouts",
      accent: "green",
    },
  },
  blocks: {
    label: "Bento",
    blurb: "Mix numbers, charts and lists in one card.",
    use: "A small dashboard about one topic. Up to 6 blocks, two per row.",
    group: "layout",
    example: {
      blocks: [
        { kind: "stat", title: "Raised", data: { value: 1840, prefix: "$", target: 2500, delta: "+$120" } },
        { kind: "stat", title: "Donors", data: { value: 37, delta: "+4" } },
        { kind: "line", span: 2, title: "This month", data: { series: [{ name: "Raised", values: [200, 420, 610, 900, 1150, 1400, 1840] }], start: day(-6), unit: "$" } },
      ],
      accent: "red",
    },
  },
};

/** JSON schemas for one or every kind, for bots (generated, so it never drifts). */
export function kindSchemas(only?: CustomKind) {
  const kinds = only ? [only] : CUSTOM_KINDS;
  return Object.fromEntries(
    kinds.map((k) => {
      const info = KIND_INFO[k];
      return [
        k,
        {
          label: info.label,
          use: info.use,
          default_size: defaultSizeFor(k),
          schema: z.toJSONSchema(payloadSchemas[k], { unrepresentable: "any" }),
          example: info.example,
        },
      ];
    }),
  );
}
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
