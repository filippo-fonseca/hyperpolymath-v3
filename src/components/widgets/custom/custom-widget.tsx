"use client";

import { useEffect, useState } from "react";
import type { Snapshot, WidgetRow } from "@/lib/dashboard-types";
import { isCustomKind, payloadSchemas, type CustomKind, type WidgetSize } from "@/lib/widgets";
import { relativeTime } from "@/lib/format";
import { widgetHistoryAction } from "@/app/actions/widgets";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { ExpandedHeader } from "@/components/dashboard/expanded";
import { useDashboard } from "@/components/dashboard/context";
import { OwnerPill, widgetOwner } from "@/components/teammates/owner-pill";
import { DigestView, ListView, MarkdownView, StatView, TableView, TimelineView } from "./renderers";

function isStale(w: WidgetRow, nowMs: number) {
  if (!w.published_at || !w.stale_after_hours) return false;
  return nowMs - Date.parse(w.published_at) > w.stale_after_hours * 3_600_000;
}

function Content({ kind, payload, compact, size }: { kind: CustomKind; payload: unknown; compact: boolean; size?: WidgetSize }) {
  const parsed = payloadSchemas[kind].safeParse(payload);
  if (!parsed.success) return <p className="text-[13px] text-ink-3">This widget&apos;s content couldn&apos;t be read.</p>;
  const p = parsed.data;
  switch (kind) {
    case "digest":
      return <DigestView p={p as never} compact={compact} />;
    case "list":
      return <ListView p={p as never} compact={compact} />;
    case "stat":
      return <StatView p={p as never} compact={compact} large={size === "l"} />;
    case "timeline":
      return <TimelineView p={p as never} compact={compact} />;
    case "markdown":
      return <MarkdownView markdown={(p as { markdown: string }).markdown} compact={compact} />;
    case "table":
      return <TableView p={p as never} compact={compact} />;
  }
}

function ownerName(w: WidgetRow) {
  return w.owner?.name ?? "a bot";
}

/** Bot-published widget on the grid. */
export function CustomWidget({ widget, size }: { widget: WidgetRow; size: WidgetSize }) {
  const { data, nowMs } = useDashboard();
  if (!isCustomKind(widget.kind)) return null;
  const stale = isStale(widget, nowMs);
  const owner = widgetOwner(widget, data.bots);
  const when = widget.published_at && size !== "s" ? relativeTime(widget.published_at, nowMs) : null;

  return (
    <div className={`flex h-full flex-col transition-opacity duration-300 ${stale ? "opacity-55 grayscale-[0.4]" : ""}`}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-gray-500">{widget.title}</span>
        {owner ? (
          <OwnerPill bot={owner} meta={when} compact={size === "s"} />
        ) : (
          when && <span className="shrink-0 text-[11.5px] text-ink-3">{when}</span>
        )}
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-hidden">
        {widget.published_at ? (
          <Content kind={widget.kind} payload={widget.payload} compact size={size} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            {owner && <BotAvatar bot={owner} size={28} className="opacity-60" />}
            <p className="mt-2 text-[13px] leading-snug text-ink-3">Waiting for {ownerName(widget)} to publish</p>
          </div>
        )}
      </div>
      {size === "s" && widget.published_at && (
        <div className="mt-1 text-[11.5px] text-ink-3">updated {relativeTime(widget.published_at, nowMs)}</div>
      )}
    </div>
  );
}

/** Expanded custom widget: full content plus publish history. */
export function CustomWidgetView({ widget }: { widget: WidgetRow }) {
  const { data, nowMs, run } = useDashboard();
  const [history, setHistory] = useState<Snapshot[] | null>(null);
  const [viewing, setViewing] = useState<Snapshot | null>(null);

  useEffect(() => {
    let live = true;
    void run(widgetHistoryAction(widget.id), { quiet: true }).then((h) => {
      if (live && h) setHistory(h);
    });
    return () => {
      live = false;
    };
  }, [widget.id, widget.published_at, run]);

  if (!isCustomKind(widget.kind)) return null;
  const stale = isStale(widget, nowMs);
  const owner = widgetOwner(widget, data.bots);
  const payload = viewing ? viewing.payload : widget.payload;

  return (
    <div>
      <ExpandedHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            {owner ? <OwnerPill bot={owner} /> : <span>No owner</span>}
            {widget.published_at && <span className="font-medium text-ink-3">· updated {relativeTime(widget.published_at, nowMs)}</span>}
            {stale && <span className="rounded-full bg-gray-150 px-2 py-px text-[11.5px] text-gray-600">Stale</span>}
          </span>
        }
        title={widget.title}
      />
      {viewing && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-[14px] bg-accent-soft px-4 py-2.5 text-[13.5px] text-accent-hover">
          <span>Viewing the version from {relativeTime(viewing.created_at, nowMs)}</span>
          <button type="button" className="font-semibold hover:underline" onClick={() => setViewing(null)}>
            Back to latest
          </button>
        </div>
      )}
      {widget.published_at || viewing ? (
        <Content kind={widget.kind} payload={payload} compact={false} />
      ) : (
        <div className="py-12 text-center text-[15px] text-ink-3">Waiting for {ownerName(widget)} to publish.</div>
      )}

      <section className="mt-12">
        <h3 className="mb-2 text-[13px] font-semibold text-gray-500">History</h3>
        {history === null ? (
          <div className="skeleton h-10 rounded-[12px]" />
        ) : history.length === 0 ? (
          <p className="text-[14px] text-ink-3">No earlier versions.</p>
        ) : (
          <ul className="divide-y divide-gray-150">
            {history.map((h, i) => {
              const active = viewing ? viewing.id === h.id : i === 0;
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => setViewing(i === 0 ? null : h)}
                    className={`flex w-full items-center justify-between gap-3 py-2.5 text-left text-[14px] transition ${
                      active ? "text-ink" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-accent" : "bg-gray-300"}`} />
                      {i === 0 ? "Latest" : relativeTime(h.created_at, nowMs)}
                    </span>
                    <span className="text-[12.5px] text-ink-3">
                      {h.bot?.name ?? ""} · {new Date(h.created_at).toLocaleString("en-US", { timeZone: data.tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
