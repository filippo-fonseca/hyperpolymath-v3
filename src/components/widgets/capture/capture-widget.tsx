"use client";

import type { Capture } from "@/lib/dashboard-types";
import type { WidgetSize } from "@/lib/widgets";
import { relativeTime } from "@/lib/format";
import { createCaptureAction } from "@/app/actions/captures";
import { stop, useFitCount } from "@/components/ui/primitives";
import { KiwiReading } from "@/components/illustrations";
import { IconLink, IconPencil } from "@/components/ui/icons";
import { useDashboard } from "@/components/dashboard/context";
import { WidgetHeader } from "@/components/dashboard/widget-chrome";
import { QuickAdd } from "../tasks/task-bits";

const ROW_H = 30;

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Where a capture came from, when it wasn't typed in the app. */
function sourceLabel(c: Capture) {
  return c.source && c.source !== "app" ? c.source : null;
}

/** Craft-style "What's on your mind?" input with the inbox below it. */
export function CaptureWidget({ size }: { size: WidgetSize }) {
  const { data, nowMs, run } = useDashboard();
  const [listRef, fit] = useFitCount<HTMLDivElement>(ROW_H, size === "l" ? 6 : 2);
  const meta = data.captures.length ? `${data.captures.length} in inbox` : "";
  const add = (content: string) => run(createCaptureAction(content), { success: "Captured" });

  if (size === "s") {
    return (
      <div className="flex h-full flex-col">
        <WidgetHeader />
        <div className="mt-1 text-[13px] text-ink-3">
          {data.resurfacing.length ? (
            <span className="font-medium text-accent">{data.resurfacing.length} back today</span>
          ) : (
            meta || "Inbox empty"
          )}
        </div>
        <div className="mt-auto flex items-center gap-2.5 rounded-[14px] bg-gray-100 px-3 py-3 text-[14px] text-ink-3">
          <IconPencil size={16} className="shrink-0 text-gray-500" />
          <span className="leading-tight">What&apos;s on your mind?</span>
        </div>
      </div>
    );
  }

  const resurfacing = size === "m" ? [] : data.resurfacing;
  const recent = data.captures.filter((c) => !resurfacing.some((r) => r.id === c.id));

  if (size === "w") {
    const cards = [...resurfacing.map((c) => ({ c, back: true })), ...recent.map((c) => ({ c, back: false }))].slice(0, 8);
    return (
      <div className="flex h-full flex-col">
        <WidgetHeader meta={meta} />
        <QuickAdd className="mt-2" placeholder="What's on your mind?" onSubmit={add} />
        {cards.length === 0 ? (
          <div className="flex flex-1 items-center justify-center gap-4">
            <KiwiReading size={112} />
            <p className="max-w-[260px] text-[13.5px] text-ink-3">Thoughts, links, ideas. Drop them here and sort them later.</p>
          </div>
        ) : (
          <ul className="mt-3 grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2.5 overflow-hidden lg:grid-cols-4">
            {cards.map(({ c, back }) => (
              <CaptureCard key={c.id} capture={c} back={back} nowMs={nowMs} />
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Large shows what's back today as its own section; medium keeps it to recent.
  const backShown = resurfacing.slice(0, Math.max(0, Math.min(2, fit - 2)));
  const headings = (backShown.length ? 1 : 0) + (backShown.length && recent.length ? 1 : 0);
  const recentShown = recent.slice(0, Math.max(0, fit - backShown.length - headings));

  return (
    <div className="flex h-full flex-col">
      <WidgetHeader meta={meta} />
      <QuickAdd className="mt-1.5" placeholder="What's on your mind?" onSubmit={add} />
      <div ref={listRef} className="mt-1.5 min-h-0 flex-1 overflow-hidden">
        {data.captures.length === 0 && resurfacing.length === 0 ? (
          size === "l" ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <KiwiReading size={124} />
              <p className="mt-1 text-[13px] text-ink-3">Thoughts, links, ideas. Sort them later.</p>
            </div>
          ) : (
            <p className="flex h-[30px] items-center text-[13px] text-ink-3">Thoughts, links, ideas. Sort them later.</p>
          )
        ) : (
          <ul>
            {backShown.length > 0 && <SectionLabel accent>Back today</SectionLabel>}
            {backShown.map((c) => (
              <Row key={c.id} capture={c} trailing={<span className="text-accent">today</span>} dot />
            ))}
            {backShown.length > 0 && recentShown.length > 0 && <SectionLabel>Recent</SectionLabel>}
            {recentShown.map((c) => (
              <Row key={c.id} capture={c} trailing={relativeTime(c.created_at, nowMs)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return <li className={`flex h-[30px] items-end pb-1.5 text-[12px] font-semibold ${accent ? "text-accent" : "text-gray-500"}`}>{children}</li>;
}

function Row({ capture, trailing, dot = false }: { capture: Capture; trailing: React.ReactNode; dot?: boolean }) {
  const domain = capture.urls[0] ? domainOf(capture.urls[0]) : null;
  const source = sourceLabel(capture);
  return (
    <li className="flex h-[30px] min-w-0 items-center gap-2 text-[14px]">
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />}
      <span className={`min-w-0 flex-1 truncate ${dot ? "font-medium" : ""}`}>{capture.content}</span>
      {domain && (
        <span className="flex max-w-[30%] shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11.5px] text-gray-600">
          <IconLink size={11} className="shrink-0" />
          <span className="truncate">{domain}</span>
        </span>
      )}
      {!domain && source && <span className="max-w-[25%] shrink-0 truncate text-[11.5px] text-ink-3">{source}</span>}
      <span className="shrink-0 text-[12.5px] tabular-nums text-gray-500">{trailing}</span>
    </li>
  );
}

function CaptureCard({ capture, back, nowMs }: { capture: Capture; back: boolean; nowMs: number }) {
  const url = capture.urls[0];
  const domain = url ? domainOf(url) : null;
  return (
    <li
      className={`flex min-h-0 min-w-0 flex-col rounded-[14px] p-3 ${back ? "bg-accent-soft" : "bg-gray-50 shadow-[inset_0_0_0_1px_rgb(20_20_20/0.04)]"}`}
    >
      <p className="line-clamp-3 min-h-0 text-[13.5px] leading-snug">{capture.content}</p>
      <div className="mt-auto flex min-w-0 items-center gap-2 pt-2 text-[11.5px] text-gray-500">
        {domain && url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={stop}
            onPointerDown={stop}
            className="flex min-w-0 items-center gap-1 truncate text-accent hover:underline"
          >
            <IconLink size={11} className="shrink-0" />
            <span className="truncate">{domain}</span>
          </a>
        ) : (
          sourceLabel(capture) && <span className="truncate">{sourceLabel(capture)}</span>
        )}
        <span className={`ml-auto shrink-0 ${back ? "font-medium text-accent" : ""}`}>{back ? "Back today" : relativeTime(capture.created_at, nowMs)}</span>
      </div>
    </li>
  );
}
