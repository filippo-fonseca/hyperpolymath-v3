"use client";

import { payloadSchemas, type Accent, type CustomKind, type WidgetSize } from "@/lib/widgets";
import { ACCENT_HEX } from "@/components/charts/core";
import { DigestView, ListView, MarkdownView, StatView, TableView, TimelineView } from "./renderers";
import { BarView, BlocksView, DonutView, HeatmapView, LineView, ProgressView } from "./chart-views";

/** Kinds whose card content fills the card's height (charts) instead of flowing. */
export const FILL_KINDS: ReadonlySet<CustomKind> = new Set(["line", "bar", "donut", "progress", "heatmap", "blocks"]);

export function fillsCard(kind: CustomKind, size: WidgetSize, payload?: unknown) {
  if (kind === "stat") return size === "s";
  if (kind === "bar" && (payload as { horizontal?: boolean } | null)?.horizontal) return false;
  if (kind === "progress") {
    const pp = payload as { style?: string; items?: unknown[] } | null;
    return (pp?.style ?? ((pp?.items?.length ?? 0) <= 4 ? "rings" : "bars")) === "rings";
  }
  return FILL_KINDS.has(kind);
}

/**
 * Draw a custom widget's payload for its kind. One entry point for the card,
 * the expanded view, the builder preview and bento blocks.
 */
export function WidgetContent({ kind, payload, compact, size }: { kind: CustomKind; payload: unknown; compact: boolean; size?: WidgetSize }) {
  const parsed = payloadSchemas[kind].safeParse(payload);
  if (!parsed.success) return <p className="text-[13px] text-ink-3">This widget&apos;s content couldn&apos;t be read.</p>;
  const p = parsed.data as { accent?: Accent; footnote?: string };
  const body = render(kind, parsed.data, compact, size);
  if (!p.footnote) return body;
  const fill = compact && size && fillsCard(kind, size, payload);
  return (
    <div className={fill ? "flex h-full min-h-0 flex-col" : ""}>
      <div className={fill ? "min-h-0 flex-1" : ""}>{body}</div>
      <p data-clamp className={`truncate text-ink-3 ${compact ? "mt-1.5 text-[11.5px]" : "mt-6 text-[13px]"}`}>
        {p.footnote}
      </p>
    </div>
  );
}

function render(kind: CustomKind, data: unknown, compact: boolean, size?: WidgetSize) {
  const p = data as never;
  const accent = (data as { accent?: Accent }).accent;
  switch (kind) {
    case "digest":
      return <DigestView p={p} compact={compact} />;
    case "list":
      return <ListView p={p} compact={compact} />;
    case "stat":
      return <StatView p={p} compact={compact} large={size === "l" || size === "w"} color={ACCENT_HEX[accent ?? "blue"]} />;
    case "timeline":
      return <TimelineView p={p} compact={compact} />;
    case "markdown":
      return <MarkdownView markdown={(data as { markdown: string }).markdown} compact={compact} />;
    case "table":
      return <TableView p={p} compact={compact} />;
    case "line":
      return <LineView p={p} compact={compact} size={size} />;
    case "bar":
      return <BarView p={p} compact={compact} size={size} />;
    case "donut":
      return <DonutView p={p} compact={compact} size={size} />;
    case "progress":
      return <ProgressView p={p} compact={compact} size={size} />;
    case "heatmap":
      return <HeatmapView p={p} compact={compact} size={size} />;
    case "blocks":
      return (
        <BlocksView
          p={p}
          compact={compact}
          size={size}
          render={(b, c) => {
            // Blocks inherit the widget's accent unless they set their own.
            const inner = { ...(b.data as object), accent: (b.data as { accent?: Accent }).accent ?? accent };
            return render(b.kind, inner, c, c ? (b.span === 2 ? "m" : "s") : undefined);
          }}
        />
      );
  }
}
