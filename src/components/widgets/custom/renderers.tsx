"use client";

import { useId } from "react";
import type {
  DigestPayload,
  ListPayload,
  StatPayload,
  TablePayload,
  TimelinePayload,
} from "@/lib/widgets";
import { IconCheck } from "@/components/ui/icons";
import { safeHref } from "@/lib/markdown";
import { Markdown } from "./markdown";

// One renderer per custom kind. `compact` is the card; otherwise the full
// expanded view. Compact renderers clip rather than scroll.

function ItemText({ text, url, compact }: { text: string; url?: string; compact: boolean }) {
  const href = safeHref(url);
  if (!href) return <>{text}</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className={compact ? "hover:underline" : "hover:text-accent"}
    >
      {text}
    </a>
  );
}

export function DigestView({ p, compact }: { p: DigestPayload; compact: boolean }) {
  if (compact) {
    const items = p.sections.flatMap((s) => s.items.map((it) => ({ ...it, section: s.title })));
    return (
      <div className="flex h-full flex-col">
        {p.summary && <p className="line-clamp-2 text-[14px] leading-snug text-ink-2">{p.summary}</p>}
        <ul className="mt-1.5 min-h-0 flex-1 overflow-hidden">
          {items.map((it, i) => (
            <li key={i} className="flex h-7 items-center gap-2 text-[14px]">
              <span className="min-w-0 flex-1 truncate">
                <ItemText text={it.text} url={it.url} compact />
              </span>
              {it.meta && <span className="shrink-0 text-[12px] text-gray-500">{it.meta}</span>}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-7">
      {p.summary && <p className="text-[16px] leading-relaxed text-ink-2">{p.summary}</p>}
      {p.sections.map((s, i) => (
        <section key={i}>
          <h3 className="mb-1 text-[13px] font-semibold text-gray-500">{s.title}</h3>
          <ul className="divide-y divide-gray-150">
            {s.items.map((it, j) => (
              <li key={j} className="flex items-baseline gap-3 py-2.5 text-[15px]">
                <span className="min-w-0 flex-1 leading-snug">
                  <ItemText text={it.text} url={it.url} compact={false} />
                </span>
                {it.meta && <span className="shrink-0 text-[13px] text-gray-500">{it.meta}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ListView({ p, compact }: { p: ListPayload; compact: boolean }) {
  return (
    <ul className={compact ? "h-full overflow-hidden" : "divide-y divide-gray-150"}>
      {p.items.map((it, i) => (
        <li key={i} className={`flex items-center gap-2.5 ${compact ? "h-7 text-[14px]" : "py-2.5 text-[15px]"}`}>
          {it.done !== undefined && (
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] ${
                it.done ? "bg-accent text-white" : "shadow-[inset_0_0_0_1.5px_var(--gray-400)]"
              }`}
            >
              {it.done && <IconCheck size={11} strokeWidth={3} />}
            </span>
          )}
          <span className={`min-w-0 flex-1 ${compact ? "truncate" : "leading-snug"} ${it.done ? "text-ink-3 line-through" : ""}`}>
            <ItemText text={it.text} url={it.url} compact={compact} />
          </span>
          {it.meta && <span className="shrink-0 text-[12.5px] text-gray-500">{it.meta}</span>}
        </li>
      ))}
    </ul>
  );
}

export function Sparkline({ values, height = 36, className = "" }: { values: number[]; height?: number; className?: string }) {
  const gid = `spark${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (values.length < 2) return null;
  const w = 100;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, height - 3 - ((v - min) / span) * (height - 6)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${w},${height} L0,${height} Z`;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={`w-full ${className}`} style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1084fe" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#1084fe" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="#1084fe" strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.2" fill="#1084fe" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function deltaTone(d?: string) {
  if (!d) return "";
  if (/^\s*\+/.test(d)) return "text-success";
  if (/^\s*[-−]/.test(d)) return "text-danger";
  return "text-gray-500";
}

export function StatView({ p, compact, large }: { p: StatPayload; compact: boolean; large?: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline gap-2">
        <span
          className={`font-light leading-none tracking-[-0.03em] tabular-nums ${
            compact ? (large ? "text-[52px]" : "text-[34px]") : "text-[64px]"
          }`}
        >
          {p.value}
        </span>
        {p.delta && <span className={`text-[13px] font-semibold ${deltaTone(p.delta)}`}>{p.delta}</span>}
      </div>
      {p.label && <div className={`mt-1.5 text-gray-500 ${compact ? "text-[13px]" : "text-[15px]"}`}>{p.label}</div>}
      {p.trend && p.trend.length > 1 && (
        <div className={compact ? "mt-auto pt-2" : "mt-8"}>
          <Sparkline values={p.trend} height={compact ? (large ? 90 : 36) : 140} />
        </div>
      )}
    </div>
  );
}

export function TimelineView({ p, compact }: { p: TimelinePayload; compact: boolean }) {
  if (compact) {
    return (
      <ul className="h-full overflow-hidden">
        {p.events.map((e, i) => (
          <li key={i} className="flex h-7 items-center gap-3 text-[14px]">
            <span className="w-14 shrink-0 truncate text-[12.5px] tabular-nums text-gray-500">{e.time}</span>
            <span className="min-w-0 flex-1 truncate">
              <ItemText text={e.text} url={e.url} compact />
            </span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ol className="relative ml-1 border-l border-gray-200">
      {p.events.map((e, i) => (
        <li key={i} className="relative pb-5 pl-5">
          <span className="absolute -left-[4.5px] top-[7px] h-2 w-2 rounded-full bg-gray-300 ring-4 ring-surface" />
          <div className="text-[12.5px] font-medium tabular-nums text-gray-500">{e.time}</div>
          <div className="mt-0.5 text-[15px] leading-snug">
            <ItemText text={e.text} url={e.url} compact={false} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function MarkdownView({ markdown, compact }: { markdown: string; compact: boolean }) {
  if (!compact) return <Markdown source={markdown} />;
  return (
    <div className="relative h-full overflow-hidden">
      <Markdown source={markdown} compact />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-surface to-transparent" />
    </div>
  );
}

export function TableView({ p, compact }: { p: TablePayload; compact: boolean }) {
  const cols = compact ? p.columns.slice(0, 3) : p.columns;
  return (
    <div className={compact ? "h-full overflow-hidden" : "-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0"}>
      <table className={`w-full border-separate border-spacing-0 text-left ${compact ? "text-[13px]" : "text-[14px]"}`}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i} className={`pb-1.5 pr-3 text-[12px] font-semibold text-gray-500 ${i > 0 ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.rows.map((r, i) => (
            <tr key={i} className="[&>td]:border-t [&>td]:border-gray-150">
              {cols.map((_, j) => (
                <td
                  key={j}
                  className={`pr-3 ${compact ? "h-7 max-w-[140px] truncate" : "py-2"} ${
                    j > 0 ? "text-right tabular-nums" : "font-medium"
                  }`}
                >
                  {r[j] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
