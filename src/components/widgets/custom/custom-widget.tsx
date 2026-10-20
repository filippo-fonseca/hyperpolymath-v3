"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import type { Snapshot, WidgetRow } from "@/lib/dashboard-types";
import { isCustomKind, payloadSchemas, type CustomKind, type WidgetSize } from "@/lib/widgets";
import { relativeTime } from "@/lib/format";
import { widgetHistoryAction } from "@/app/actions/widgets";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { KiwiWaiting } from "@/components/illustrations";
import { Button, stop } from "@/components/ui/primitives";
import { IconGear } from "@/components/ui/icons";
import { ExpandedHeader } from "@/components/dashboard/expanded";
import { useDashboard } from "@/components/dashboard/context";
import { WidgetHeader, useWidgetFrame } from "@/components/dashboard/widget-chrome";
import { useClamp } from "./clamp";
import { OwnerPill, widgetOwner } from "@/components/teammates/owner-pill";
import { WidgetIcon } from "@/components/ui/widget-icon";
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
      return <StatView p={p as never} compact={compact} large={size === "l" || size === "w"} />;
    case "timeline":
      return <TimelineView p={p as never} compact={compact} />;
    case "markdown":
      return <MarkdownView markdown={(p as { markdown: string }).markdown} compact={compact} />;
    case "table":
      return <TableView p={p as never} compact={compact} size={size} />;
  }
}

function ownerName(w: WidgetRow) {
  return w.owner?.name ?? "a bot";
}

/** Rows the card needs for its content: at least two, so the grid stays tidy. */
function rowsFor(card: HTMLElement, natural: number) {
  const grid = card.parentElement;
  const span = Number(card.dataset.rows) || 0;
  if (!grid || !span) return null;
  const gap = parseFloat(getComputedStyle(grid).rowGap) || 0;
  const row = (card.offsetHeight - (span - 1) * gap) / span;
  if (!(row > 0)) return null;
  return Math.max(2, Math.ceil((natural + gap) / (row + gap) - 0.02));
}

/** Bot-published widget on the grid. */
export function CustomWidget({ widget, size }: { widget: WidgetRow; size: WidgetSize }) {
  const { data, nowMs } = useDashboard();
  const frame = useWidgetFrame();
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [body, setBody] = useState<HTMLDivElement | null>(null);
  const [inner, setInner] = useState<HTMLDivElement | null>(null);
  const clamp = useClamp(body, inner, widget.payload);
  const fit = frame?.fit;

  // Tell the grid how tall the content really is, so short content gets a
  // shorter card instead of a blank band (large and wide only shrink).
  useLayoutEffect(() => {
    if (!fit || !root || !body || !inner) return;
    const card = root.closest<HTMLElement>("[data-rows]");
    if (!card) return;
    const report = () => {
      const pad = card.firstElementChild ? card.offsetHeight - root.offsetHeight : 0;
      const natural = root.offsetHeight - body.clientHeight + inner.offsetHeight + Math.max(0, pad);
      fit(rowsFor(card, natural));
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [fit, root, body, inner, size]);

  if (!isCustomKind(widget.kind)) return null;
  const stale = isStale(widget, nowMs);
  const owner = widgetOwner(widget, data.bots);
  const when = widget.published_at ? relativeTime(widget.published_at, nowMs) : null;

  return (
    <div ref={setRoot} className={`flex h-full min-w-0 flex-col transition-opacity duration-300 ${stale ? "opacity-55 grayscale-[0.4]" : ""}`}>
      <WidgetHeader
        icon={<WidgetIcon icon={widget.icon} size={15} />}
        meta={
          owner ? (
            <OwnerPill bot={owner} meta={size === "s" ? null : when} compact={size === "s"} />
          ) : (
            when && <span className="text-[11.5px] font-normal text-ink-3">{when}</span>
          )
        }
      />
      {size === "s" && owner && when && <div className="-mt-0.5 text-[11.5px] text-ink-3">{stale ? `Stale · ${when}` : `Updated ${when}`}</div>}
      <div ref={setBody} className="relative mt-1.5 min-h-0 min-w-0 flex-1 overflow-hidden">
        {widget.published_at ? (
          <div ref={setInner} className={size === "s" && widget.kind === "stat" ? "h-full" : ""}>
            <Content kind={widget.kind} payload={widget.payload} compact size={size} />
          </div>
        ) : (
          <div
            className={`flex h-full items-center justify-center ${size === "m" ? "gap-3" : "flex-col text-center"} ${size === "l" || size === "w" ? "gap-1" : ""}`}
          >
            {size === "s" ? (
              owner && <BotAvatar bot={owner} size={28} className="opacity-60" />
            ) : (
              <KiwiWaiting size={size === "m" ? 76 : 132} className="shrink-0" />
            )}
            <p className={`text-[13px] leading-snug text-ink-3 ${size === "s" ? "mt-2" : ""}`}>Waiting for {ownerName(widget)} to publish</p>
          </div>
        )}
        {clamp.more > 0 && (
          <button
            type="button"
            onPointerDown={stop}
            onClick={(e) => {
              e.stopPropagation();
              frame?.open();
            }}
            className="absolute left-0 flex h-6 items-center rounded-full text-[12.5px] font-medium text-gray-500 transition hover:text-accent"
            style={{ top: clamp.top + 2 }}
          >
            {clamp.more} more
          </button>
        )}
      </div>
    </div>
  );
}

/** Expanded custom widget: full content plus publish history. */
export function CustomWidgetView({ widget }: { widget: WidgetRow }) {
  const { data, nowMs, run, openWidgetSettings } = useDashboard();
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
            <WidgetIcon icon={widget.icon} size={18} />
            {owner ? <OwnerPill bot={owner} /> : <span>No owner</span>}
            {widget.published_at && <span className="font-medium text-ink-3">· updated {relativeTime(widget.published_at, nowMs)}</span>}
            {stale && <span className="rounded-full bg-gray-150 px-2 py-px text-[11.5px] text-gray-600">Stale</span>}
          </span>
        }
        title={widget.title}
        aside={
          <Button size="sm" variant="soft" onClick={() => openWidgetSettings(widget.id)}>
            <IconGear size={15} /> Settings
          </Button>
        }
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
        <div className="flex flex-col items-center pb-8 text-center">
          <KiwiWaiting size={148} />
          <p className="mt-1 text-[15px] text-ink-3">Waiting for {ownerName(widget)} to publish.</p>
        </div>
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
