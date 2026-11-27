"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { EASE, Tooltip, fmtNum, labelEvery, niceTicks, useHover, useSize } from "./core";

export type BarSeries = { name: string; values: (number | null)[]; color: string };

/** Column path with a 4px rounded data end and a square baseline. */
function column(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/**
 * Vertical columns, grouped or stacked. Columns grow from the baseline in a
 * quick stagger; hovering a slot highlights it and shows every series' value.
 */
export function BarChart({
  series,
  labels,
  unit,
  stacked,
  goal,
  height,
  axes: axesProp = true,
  highlightLast = false,
  className = "",
}: {
  series: BarSeries[];
  labels: string[];
  unit?: string;
  stacked?: boolean;
  goal?: { value: number; label?: string };
  height?: number;
  axes?: boolean;
  /** Draw the earlier columns softer so the latest stands out (single series). */
  highlightLast?: boolean;
  className?: string;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  const reduce = useReducedMotion();
  const { tip, setTip, active, setActive, clear } = useHover();
  const n = Math.max(...series.map((s) => s.values.length), 1);
  const w = size.width;
  const h = height ?? size.height;
  // Short charts drop their axes rather than cram them.
  const axes = axesProp && h >= 72;

  const geo = useMemo(() => {
    const totals = Array.from({ length: n }, (_, i) =>
      stacked ? series.reduce((a, s) => a + Math.max(0, s.values[i] ?? 0), 0) : Math.max(0, ...series.map((s) => s.values[i] ?? 0)),
    );
    const ticks = niceTicks(Math.max(...totals, goal?.value ?? 0, 0), h - 26 < 56 ? 2 : h - 26 < 110 ? 3 : 4);
    const top = ticks.at(-1) || 1;
    const padL = axes ? Math.max(22, String(fmtNum(top)).length * 6.5 + 8) : 0;
    const padB = axes ? 20 : 0;
    const padT = 6;
    const iw = Math.max(1, w - padL - 4);
    const ih = Math.max(1, h - padT - padB);
    const slot = iw / n;
    const groups = stacked ? 1 : series.length;
    // Columns cap at 24px and leave air in the slot; a 2px gap separates touching columns.
    const bw = Math.max(2, Math.min(24, (slot * 0.72 - (groups - 1) * 2) / groups));
    const y = (v: number) => padT + ih - (v / top) * ih;
    return { ticks, top, padL, padB, padT, iw, ih, slot, bw, y, groups };
  }, [series, stacked, goal, w, h, n, axes]);

  const every = labelEvery(n, geo.iw, 44);
  const ready = w > 0 && h > 0;

  const bars: { key: string; d: string; color: string; i: number; soft: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const cx = geo.padL + geo.slot * i + geo.slot / 2;
    if (stacked) {
      let acc = 0;
      const parts = series.map((s, j) => ({ v: Math.max(0, s.values[i] ?? 0), j })).filter((p) => p.v > 0);
      parts.forEach((p, k) => {
        const y0 = geo.y(acc);
        const y1 = geo.y(acc + p.v);
        acc += p.v;
        // 2px surface gap between stacked segments; only the top segment gets the rounded end.
        const gap = k > 0 ? 2 : 0;
        const hgt = Math.max(0, y0 - y1 - gap);
        const d = k === parts.length - 1 ? column(cx - geo.bw / 2, y1, geo.bw, hgt) : `M${cx - geo.bw / 2},${y1}h${geo.bw}v${hgt}h${-geo.bw}Z`;
        bars.push({ key: `${i}-${p.j}`, d, color: series[p.j].color, i, soft: false });
      });
    } else {
      series.forEach((s, j) => {
        const v = Math.max(0, s.values[i] ?? 0);
        const x = cx - (geo.groups * geo.bw + (geo.groups - 1) * 2) / 2 + j * (geo.bw + 2);
        bars.push({ key: `${i}-${j}`, d: column(x, geo.y(v), geo.bw, geo.y(0) - geo.y(v)), color: s.color, i, soft: highlightLast && series.length === 1 && i !== n - 1 });
      });
    }
  }

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n)));
    setActive(i);
    const total = stacked ? series.reduce((a, s) => a + (s.values[i] ?? 0), 0) : Math.max(...series.map((s) => s.values[i] ?? 0));
    setTip({
      x: geo.padL + geo.slot * i + geo.slot / 2,
      y: geo.y(total),
      title: labels[i],
      rows: [
        ...series.map((s) => ({ color: s.color, label: s.name, value: fmtNum(s.values[i] ?? null, unit) })),
        ...(stacked && series.length > 1 ? [{ label: "Total", value: fmtNum(total, unit) }] : []),
      ],
    });
  };

  return (
    <div ref={ref} className={`relative min-h-0 w-full ${height ? "" : "h-full"} ${className}`} style={height ? { height } : undefined}>
      {ready && (
        <svg width={w} height={h} className="block overflow-visible" role="img" aria-label={`${series.map((s) => s.name).join(", ")} by ${labels.length} categories`}>
          {axes &&
            geo.ticks.map((t) => (
              <g key={t}>
                <line x1={geo.padL} x2={w} y1={geo.y(t)} y2={geo.y(t)} stroke={t === 0 ? "var(--gray-250)" : "var(--gray-150)"} strokeWidth={1} />
                <text x={geo.padL - 6} y={geo.y(t)} dy="0.32em" textAnchor="end" className="fill-gray-500 text-[10.5px] tabular-nums">
                  {fmtNum(t)}
                </text>
              </g>
            ))}
          {active !== null && <rect x={geo.padL + geo.slot * active} y={geo.padT} width={geo.slot} height={geo.ih} rx={6} fill="var(--gray-100)" />}
          {bars.map((b) => (
            <motion.path
              key={b.key}
              d={b.d}
              fill={b.color}
              opacity={active !== null && active !== b.i ? 0.45 : b.soft ? 0.55 : 1}
              style={{ transformBox: "fill-box", originY: 1 }}
              initial={reduce ? false : { scaleY: 0 }}
              animate={{ scaleY: 1, d: b.d }}
              transition={{ scaleY: { duration: 0.6, ease: EASE, delay: Math.min(0.5, (b.i / n) * 0.5) }, d: { duration: 0.5, ease: EASE } }}
            />
          ))}
          {goal && (
            <g pointerEvents="none">
              <line x1={geo.padL} x2={w} y1={geo.y(goal.value)} y2={geo.y(goal.value)} stroke="var(--gray-400)" strokeWidth={1} strokeDasharray="3 4" />
              {goal.label && (
                <text x={w - 2} y={geo.y(goal.value) - 5} textAnchor="end" className="fill-gray-500 text-[10.5px] font-medium">
                  {goal.label}
                </text>
              )}
            </g>
          )}
          {axes &&
            labels.slice(0, n).map((l, i) =>
              i % every === 0 ? (
                <text key={i} x={geo.padL + geo.slot * i + geo.slot / 2} y={h - 4} textAnchor="middle" className="fill-gray-500 text-[10.5px]">
                  {l}
                </text>
              ) : null,
            )}
          <rect x={geo.padL} y={0} width={geo.iw} height={h} fill="transparent" onPointerMove={onMove} onPointerLeave={clear} />
        </svg>
      )}
      <Tooltip tip={tip} width={w} />
    </div>
  );
}

/**
 * Ranked horizontal bars in HTML, so long category names stay crisp and
 * wrap-safe. Values sit at the bar tips. Best for "which was biggest".
 */
export function HBarChart({
  rows,
  unit,
  color,
  max: maxRows,
  className = "",
}: {
  rows: { label: string; value: number; color?: string }[];
  unit?: string;
  color: string;
  max?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const shown = maxRows ? rows.slice(0, maxRows) : rows;
  const top = Math.max(...shown.map((r) => r.value), 0) || 1;
  return (
    <ul className={`flex flex-col gap-2 ${className}`}>
      {shown.map((r, i) => (
        <li key={`${r.label}-${i}`} data-clamp className="grid grid-cols-[minmax(0,38%)_1fr] items-center gap-3 text-[13px]">
          <span className="truncate text-ink-2" title={r.label}>
            {r.label}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="relative h-[14px] min-w-0 flex-1">
              <motion.span
                className="absolute inset-y-0 left-0 rounded-r-[4px] rounded-l-[2px]"
                style={{ background: r.color ?? color }}
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${Math.max(r.value > 0 ? 1.5 : 0, (r.value / top) * 100)}%` }}
                transition={{ duration: 0.7, ease: EASE, delay: i * 0.05 }}
              />
            </span>
            <span className="w-10 shrink-0 text-right text-[12px] font-semibold tabular-nums text-ink">{fmtNum(r.value, unit)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
