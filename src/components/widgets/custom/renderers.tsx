"use client";

import { useId, type ReactNode } from "react";
import type {
  DigestPayload,
  ListPayload,
  StatPayload,
  TablePayload,
  TimelinePayload,
  WidgetSize,
} from "@/lib/widgets";
import { IconCheck } from "@/components/ui/icons";
import { safeHref } from "@/lib/markdown";
import { Markdown } from "./markdown";

// One renderer per custom kind. `compact` is the card; otherwise the full
// expanded view. Compact renderers lay out at their natural height and mark
// rows with `data-clamp`, so the card can hide what doesn't fit (see clamp.tsx)
// and size itself to short content. Bot text is never trusted to be short:
// everything wraps, long words included.

const WRAP = "[overflow-wrap:anywhere]";

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

/**
 * A compact row: the text gets the room (two lines before it truncates) and
 * the meta label sits on the right when the card is wide enough, or under the
 * text when it isn't. Needs an `@container` ancestor.
 */
function CompactRow({ lead, text, meta, muted = false }: { lead?: ReactNode; text: ReactNode; meta?: string; muted?: boolean }) {
  return (
    <li data-clamp className="flex min-w-0 items-start gap-2.5 py-[5px] text-[14px] leading-[1.35]">
      {lead}
      <div className="min-w-0 flex-1">
        <div className={`line-clamp-2 ${WRAP} ${muted ? "text-ink-3 line-through" : ""}`}>{text}</div>
        {meta && <div className={`truncate text-[12px] text-gray-500 @[380px]:hidden`}>{meta}</div>}
      </div>
      {meta && (
        <span className="hidden max-w-[38%] shrink-0 truncate pt-px text-[12px] text-gray-500 @[380px]:block" title={meta}>
          {meta}
        </span>
      )}
    </li>
  );
}

export function DigestView({ p, compact }: { p: DigestPayload; compact: boolean }) {
  if (compact) {
    return (
      <div className="@container">
        {p.summary && (
          <p data-clamp className={`line-clamp-3 pb-1 text-[14px] leading-snug text-ink-2 ${WRAP}`}>
            {p.summary}
          </p>
        )}
        {p.sections.map((s, i) => (
          <section key={i}>
            {(p.sections.length > 1 || s.title) && (
              <h3 data-clamp="heading" className="truncate pb-0.5 pt-2 text-[12px] font-semibold text-gray-500">
                {s.title}
              </h3>
            )}
            <ul>
              {s.items.map((it, j) => (
                <CompactRow key={j} text={<ItemText text={it.text} url={it.url} compact />} meta={it.meta} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-7">
      {p.summary && <p className={`text-[16px] leading-relaxed text-ink-2 ${WRAP}`}>{p.summary}</p>}
      {p.sections.map((s, i) => (
        <section key={i}>
          <h3 className="mb-1 text-[13px] font-semibold text-gray-500">{s.title}</h3>
          <ul className="divide-y divide-gray-150">
            {s.items.map((it, j) => (
              <li key={j} className="flex items-baseline gap-3 py-2.5 text-[15px]">
                <span className={`min-w-0 flex-1 leading-snug ${WRAP}`}>
                  <ItemText text={it.text} url={it.url} compact={false} />
                </span>
                {it.meta && <span className="max-w-[40%] shrink-0 text-right text-[13px] text-gray-500">{it.meta}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function CheckMark({ done }: { done: boolean }) {
  return (
    <span
      className={`mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] ${
        done ? "bg-accent text-white" : "shadow-[inset_0_0_0_1.5px_var(--gray-400)]"
      }`}
    >
      {done && <IconCheck size={11} strokeWidth={3} />}
    </span>
  );
}

export function ListView({ p, compact }: { p: ListPayload; compact: boolean }) {
  if (compact) {
    return (
      <ul className="@container">
        {p.items.map((it, i) => (
          <CompactRow
            key={i}
            lead={it.done !== undefined ? <CheckMark done={it.done} /> : undefined}
            text={<ItemText text={it.text} url={it.url} compact />}
            meta={it.meta}
            muted={!!it.done}
          />
        ))}
      </ul>
    );
  }
  return (
    <ul className="divide-y divide-gray-150">
      {p.items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5 py-2.5 text-[15px]">
          {it.done !== undefined && <CheckMark done={it.done} />}
          <span className={`min-w-0 flex-1 leading-snug ${WRAP} ${it.done ? "text-ink-3 line-through" : ""}`}>
            <ItemText text={it.text} url={it.url} compact={false} />
          </span>
          {it.meta && <span className="max-w-[40%] shrink-0 text-right text-[12.5px] text-gray-500">{it.meta}</span>}
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

/** Long values step down in size so they stay on one line in a small card. */
function statSize(value: string, compact: boolean, large?: boolean) {
  if (!compact) return value.length > 12 ? "text-[44px]" : "text-[64px]";
  if (large) return value.length > 10 ? "text-[36px]" : "text-[52px]";
  return value.length > 8 ? "text-[22px]" : value.length > 5 ? "text-[28px]" : "text-[34px]";
}

export function StatView({ p, compact, large }: { p: StatPayload; compact: boolean; large?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col ${compact ? "h-full" : ""}`}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <span
          className={`min-w-0 font-light leading-none tracking-[-0.03em] tabular-nums [overflow-wrap:break-word] ${statSize(String(p.value), compact, large)}`}
        >
          {p.value}
        </span>
        {p.delta && <span className={`text-[13px] font-semibold ${deltaTone(p.delta)}`}>{p.delta}</span>}
      </div>
      {p.label && <div className={`mt-1.5 line-clamp-2 text-gray-500 ${WRAP} ${compact ? "text-[13px]" : "text-[15px]"}`}>{p.label}</div>}
      {p.trend && p.trend.length > 1 && (
        <div className={compact ? "mt-auto pt-2" : "mt-8"}>
          <Sparkline values={p.trend} height={compact ? (large ? 90 : 26) : 140} />
        </div>
      )}
    </div>
  );
}

export function TimelineView({ p, compact }: { p: TimelinePayload; compact: boolean }) {
  if (compact) {
    return (
      <ul>
        {p.events.map((e, i) => (
          <li key={i} data-clamp className="flex min-w-0 items-start gap-3 py-[5px] text-[14px] leading-[1.35]">
            <span className="w-14 shrink-0 truncate pt-px text-[12.5px] tabular-nums text-gray-500" title={e.time}>
              {e.time}
            </span>
            <span className={`line-clamp-2 min-w-0 flex-1 ${WRAP}`}>
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
          <div className={`mt-0.5 text-[15px] leading-snug ${WRAP}`}>
            <ItemText text={e.text} url={e.url} compact={false} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function MarkdownView({ markdown, compact }: { markdown: string; compact: boolean }) {
  return <Markdown source={markdown} compact={compact} />;
}

type Cell = string | number | null;

/** Looks like an amount, count or date: right-aligned and kept on its own. */
function isNumberish(v: Cell) {
  if (typeof v === "number") return true;
  return typeof v === "string" && /^[\s$€£¥+\-−~≈]*\d[\d.,:/\s]*(%|k|m|bn|h|d)?\b/i.test(v);
}

/**
 * Column plan for a table: the wordiest text column gets the flexible width
 * (and wraps to two lines); short or numeric columns shrink to their content,
 * capped so one long value can't squeeze the rest.
 */
export function planColumns(p: TablePayload, count: number) {
  const cols = p.columns.slice(0, count).map((title, j) => {
    const values = p.rows.map((r) => r[j] ?? null).filter((v): v is string | number => v !== null && v !== "");
    const lengths = values.map((v) => String(v).length);
    const avg = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
    const longest = Math.max(title.length, ...lengths, 1);
    const numeric = values.length > 0 && values.filter(isNumberish).length / values.length >= 0.6;
    return { title, avg, longest, numeric };
  });
  const textCols = cols.map((c, j) => ({ c, j })).filter(({ c }) => !c.numeric);
  const primary = (textCols.length ? textCols : cols.map((c, j) => ({ c, j }))).reduce((a, b) => (b.c.avg > a.c.avg ? b : a)).j;
  const template = cols
    .map((c, j) => (j === primary ? "minmax(0,1fr)" : `fit-content(${Math.min(c.longest + 1, c.numeric ? 14 : 18)}ch)`))
    .join(" ");
  return { cols, primary, template };
}

export function TableView({ p, compact, size }: { p: TablePayload; compact: boolean; size?: WidgetSize }) {
  if (!compact) {
    return (
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full border-separate border-spacing-0 text-left text-[14px]">
          <thead>
            <tr>
              {p.columns.map((c, i) => (
                <th key={i} className="whitespace-nowrap pb-1.5 pr-4 text-[12px] font-semibold text-gray-500">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.rows.map((r, i) => (
              <tr key={i} className="[&>td]:border-t [&>td]:border-gray-150">
                {p.columns.map((_, j) => (
                  <td key={j} className={`py-2 pr-4 align-top ${j === 0 ? "min-w-[180px] font-medium" : ""} ${isNumberish(r[j] ?? null) ? "tabular-nums" : ""}`}>
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

  const { cols, primary, template } = planColumns(p, size === "s" ? 2 : size === "w" ? 6 : 3);
  const align = (j: number) => (cols[j].numeric && j !== primary ? "text-right tabular-nums" : "");
  return (
    <div className="grid gap-x-3 text-[13px]" style={{ gridTemplateColumns: template }}>
      <div data-clamp className="col-span-full grid grid-cols-subgrid pb-1">
        {cols.map((c, j) => (
          <div key={j} className={`truncate text-[12px] font-semibold text-gray-500 ${align(j)}`} title={c.title}>
            {c.title}
          </div>
        ))}
      </div>
      {p.rows.map((r, i) => (
        <div key={i} data-clamp className="col-span-full grid grid-cols-subgrid border-t border-gray-150 py-[5px] leading-[1.35]">
          {cols.map((_, j) => {
            const v = r[j] ?? "";
            return (
              <div
                key={j}
                title={String(v)}
                className={`min-w-0 ${j === primary ? `line-clamp-2 font-medium ${WRAP}` : `line-clamp-2 text-ink-2 ${WRAP}`} ${align(j)}`}
              >
                {v}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
