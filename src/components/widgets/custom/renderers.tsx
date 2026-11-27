"use client";

import { useId, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { DigestPayload, ListItem, ListPayload, StatPayload, TablePayload, TimelinePayload, Tone, WidgetSize } from "@/lib/widgets";
import { IconCheck } from "@/components/ui/icons";
import { safeHref } from "@/lib/markdown";
import { formatAt } from "@/lib/format";
import { CountUp, EASE, fmtNum, tint, useChartEnv } from "@/components/charts/core";
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
const TONE_DOT: Record<Tone, string> = { positive: "var(--success)", negative: "var(--danger)", warning: "#f0a020", neutral: "var(--gray-400)" };

/** An item's small extras: its emoji, a tone dot, and a badge. */
function Lead({ it }: { it: Pick<ListItem, "icon" | "tone"> }) {
  if (it.icon) return <span className="w-[18px] shrink-0 text-center text-[14px] leading-[1.35]">{it.icon}</span>;
  if (it.tone) return <span className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: TONE_DOT[it.tone] }} />;
  return null;
}

function Badge({ text }: { text?: string }) {
  if (!text) return null;
  return <span className="ml-1.5 inline-flex translate-y-[-1px] items-center rounded-full bg-accent-soft px-1.5 py-px align-middle text-[10.5px] font-semibold uppercase tracking-[0.02em] text-accent-hover">{text}</span>;
}

/** The trailing label: a formatted `at` beats free-text meta, and both show when given. */
function useMeta(it: { meta?: string; at?: string }) {
  const { tz, nowMs } = useChartEnv();
  const when = it.at ? formatAt(it.at, tz, nowMs) : undefined;
  return [when, it.meta].filter(Boolean).join(" · ") || undefined;
}

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
                <ItemRow key={j} it={it} />
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
              <FullItemRow key={j} it={it} />
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

/** A list or digest item on the card. */
function ItemRow({ it }: { it: ListItem }) {
  const meta = useMeta(it);
  return (
    <CompactRow
      lead={it.done !== undefined ? <CheckMark done={it.done} /> : <Lead it={it} />}
      text={
        <>
          <ItemText text={it.text} url={it.url} compact />
          <Badge text={it.badge} />
        </>
      }
      meta={meta}
      muted={!!it.done}
    />
  );
}

/** A list or digest item in the expanded view. */
function FullItemRow({ it }: { it: ListItem }) {
  const meta = useMeta(it);
  return (
    <li className="flex items-start gap-2.5 py-2.5 text-[15px]">
      {it.done !== undefined ? <CheckMark done={it.done} /> : <Lead it={it} />}
      <span className={`min-w-0 flex-1 leading-snug ${WRAP} ${it.done ? "text-ink-3 line-through" : ""}`}>
        <ItemText text={it.text} url={it.url} compact={false} />
        <Badge text={it.badge} />
      </span>
      {meta && <span className="max-w-[40%] shrink-0 text-right text-[12.5px] text-gray-500">{meta}</span>}
    </li>
  );
}

export function ListView({ p, compact }: { p: ListPayload; compact: boolean }) {
  if (compact) {
    return (
      <ul className="@container">
        {p.items.map((it, i) => (
          <ItemRow key={i} it={it} />
        ))}
      </ul>
    );
  }
  return (
    <ul className="divide-y divide-gray-150">
      {p.items.map((it, i) => (
        <FullItemRow key={i} it={it} />
      ))}
    </ul>
  );
}

export function Sparkline({ values, height = 36, color = "#1084fe", className = "" }: { values: number[]; height?: number; color?: string; className?: string }) {
  const gid = `spark${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const reduce = useReducedMotion();
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
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={`w-full overflow-visible ${className}`} style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <clipPath id={`${gid}c`}>
        <motion.rect x={0} y={-4} height={height + 8} initial={reduce ? false : { width: 0 }} animate={{ width: w + 4 }} transition={{ duration: 1, ease: EASE }} />
      </clipPath>
      <g clipPath={`url(#${gid}c)`}>
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </g>
      <motion.circle
        cx={lx}
        cy={ly}
        r="2.4"
        fill={color}
        vectorEffect="non-scaling-stroke"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.95 }}
      />
    </svg>
  );
}

/** Green when the delta moves the good way, red when it doesn't. */
function deltaTone(d: string | undefined, good: "up" | "down" = "up") {
  if (!d) return "";
  const up = /^\s*\+/.test(d);
  const down = /^\s*[-−]/.test(d);
  if (!up && !down) return "text-gray-500";
  return up === (good === "up") ? "text-success" : "text-danger";
}

/** Long values step down in size so they stay on one line in a small card. */
function statSize(value: string, compact: boolean, large?: boolean) {
  if (!compact) return value.length > 12 ? "text-[44px]" : "text-[64px]";
  if (large) return value.length > 10 ? "text-[36px]" : "text-[52px]";
  return value.length > 8 ? "text-[22px]" : value.length > 5 ? "text-[28px]" : "text-[34px]";
}

const STAT_PX: Record<string, number> = { "text-[22px]": 22, "text-[28px]": 28, "text-[34px]": 34, "text-[36px]": 36, "text-[44px]": 44, "text-[52px]": 52, "text-[64px]": 64 };

export function StatView({ p, compact, large, color = "#1084fe" }: { p: StatPayload; compact: boolean; large?: boolean; color?: string }) {
  const { tz, nowMs } = useChartEnv();
  const reduce = useReducedMotion();
  const numeric = typeof p.value === "number";
  const shown = `${p.prefix ?? ""}${numeric ? fmtNum(p.value as number) : p.value}${p.unit ? (p.unit.length <= 2 ? p.unit : ` ${p.unit}`) : ""}`;
  const pct = numeric && p.target ? Math.max(0, Math.min(1, (p.value as number) / p.target)) : null;
  return (
    <div className={`flex min-w-0 flex-col [container-type:inline-size] ${compact ? "h-full" : ""}`}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <span
          className={`min-w-0 whitespace-nowrap font-light leading-none tracking-[-0.03em] tabular-nums ${statSize(shown, compact, large)}`}
          // Never wraps: in a narrow card the number shrinks to fit instead.
          style={{ fontSize: `min(${STAT_PX[statSize(shown, compact, large)] ?? 34}px, ${Math.floor(150 / Math.max(3, shown.length))}cqw)` }}
        >
          {p.prefix && <span className="mr-0.5 text-[0.6em] font-normal text-ink-2">{p.prefix}</span>}
          {numeric ? <CountUp value={p.value as number} /> : p.value}
          {p.unit && <span className="ml-0.5 text-[0.5em] font-normal text-ink-2">{p.unit}</span>}
        </span>
        {p.delta && <span className={`text-[13px] font-semibold ${deltaTone(p.delta, p.good)}`}>{p.delta}</span>}
      </div>
      {p.label && <div className={`mt-1.5 line-clamp-2 text-gray-500 ${WRAP} ${compact ? "text-[13px]" : "text-[15px]"}`}>{p.label}</div>}
      {pct !== null && (
        <div className={compact ? "mt-2.5" : "mt-6"}>
          <div className="relative h-[6px] overflow-hidden rounded-full" style={{ background: tint(color, 16) }}>
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ background: color }}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${pct * 100}%` }}
              transition={{ duration: 1, ease: EASE, delay: 0.15 }}
            />
          </div>
          <div className="mt-1 text-[11.5px] tabular-nums text-ink-3">
            {Math.round(pct * 100)}% of {p.prefix ?? ""}
            {fmtNum(p.target!, p.unit)}
          </div>
        </div>
      )}
      {p.trend && p.trend.length > 1 && (
        <div className={compact ? "mt-auto pt-2" : "mt-8"}>
          <Sparkline values={p.trend} color={color} height={compact ? (large ? 90 : 26) : 140} />
        </div>
      )}
      {p.at && !compact && <div className="mt-3 text-[12.5px] text-ink-3">As of {formatAt(p.at, tz, nowMs)}</div>}
    </div>
  );
}

function EventTime({ e, className }: { e: TimelinePayload["events"][number]; className: string }) {
  const { tz, nowMs } = useChartEnv();
  const label = e.at ? formatAt(e.at, tz, nowMs) : e.time;
  return (
    <span className={className} title={e.at ?? e.time}>
      {label}
    </span>
  );
}

export function TimelineView({ p, compact }: { p: TimelinePayload; compact: boolean }) {
  if (compact) {
    return (
      <ul>
        {p.events.map((e, i) => (
          <li key={i} data-clamp className="flex min-w-0 items-start gap-3 py-[5px] text-[14px] leading-[1.35]">
            <EventTime e={e} className="w-[92px] shrink-0 truncate pt-px text-[12.5px] tabular-nums text-gray-500" />
            <span className={`line-clamp-2 min-w-0 flex-1 ${WRAP}`}>
              {e.icon && <span className="mr-1.5">{e.icon}</span>}
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
          <span
            className="absolute -left-[4.5px] top-[7px] h-2 w-2 rounded-full ring-4 ring-surface"
            style={{ background: e.tone ? TONE_DOT[e.tone] : "var(--gray-300)" }}
          />
          <EventTime e={e} className="block text-[12.5px] font-medium tabular-nums text-gray-500" />
          <div className={`mt-0.5 text-[15px] leading-snug ${WRAP}`}>
            {e.icon && <span className="mr-1.5">{e.icon}</span>}
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
  // On a narrow card only one other column stays: the first numeric one, else the first.
  const others = cols.map((_, j) => j).filter((j) => j !== primary);
  const second = others.find((j) => cols[j].numeric) ?? others[0];
  const template = cols
    .map((c, j) => (j === primary ? "minmax(0,1fr)" : `fit-content(${Math.min(c.longest + 1, c.numeric ? 14 : 18)}ch)`))
    .join(" ");
  return { cols, primary, second, template };
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

  const { cols, primary, second, template } = planColumns(p, size === "s" ? 2 : size === "w" ? 6 : 3);
  const align = (j: number) => (cols[j].numeric && j !== primary ? "text-right tabular-nums" : "");
  const narrow = (j: number) => (j !== primary && j !== second ? "@max-[400px]:hidden" : "");
  return (
    <div className="@container">
      <div className="grid gap-x-3 text-[13px]" style={{ gridTemplateColumns: template }}>
        <div data-clamp="heading" className="col-span-full grid grid-cols-subgrid pb-1">
          {cols.map((c, j) => (
            <div key={j} className={`truncate text-[12px] font-semibold text-gray-500 ${align(j)} ${narrow(j)}`} title={c.title}>
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
                  className={`min-w-0 ${j === primary ? `line-clamp-2 font-medium ${WRAP}` : `line-clamp-2 text-ink-2 ${WRAP}`} ${align(j)} ${narrow(j)}`}
                >
                  {v}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
