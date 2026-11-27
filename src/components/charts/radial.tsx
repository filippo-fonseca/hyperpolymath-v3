"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CountUp, EASE, fmtNum, tint } from "./core";

// Round charts: a donut for parts of a whole and Activity-style progress rings.

/**
 * Parts of a whole. Segments sweep in one after another with a 2px surface
 * gap; hovering one lifts it and puts its value in the middle.
 */
export function Donut({
  segments,
  center,
  unit,
  size = 160,
  thickness,
  legend = true,
  className = "",
}: {
  segments: { label: string; value: number; color: string }[];
  center?: { value: string | number; label?: string };
  unit?: string;
  size?: number;
  thickness?: number;
  legend?: boolean | "below";
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const total = segments.reduce((a, s) => a + s.value, 0);
  const stroke = thickness ?? Math.max(10, size * 0.13);
  const r = (size - stroke) / 2 - 3;
  const c = 2 * Math.PI * r;
  const gap = segments.filter((s) => s.value > 0).length > 1 ? 2.5 : 0;
  const lens = segments.map((s) => (total ? (s.value / total) * c : 0));
  const arcs = segments.map((s, i) => ({ ...s, i, len: Math.max(0, lens[i] - gap), offset: lens.slice(0, i).reduce((a, b) => a + b, 0) }));
  const hovered = hover !== null ? segments[hover] : null;
  const centerValue = hovered ? hovered.value : (center?.value ?? total);
  const centerLabel = hovered ? hovered.label : center?.label;

  const chart = (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gray-150)" strokeWidth={stroke} />
        {arcs.map((a) =>
          a.len > 0 ? (
            <motion.circle
              key={a.i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={a.color}
              strokeLinecap="butt"
              strokeDashoffset={-a.offset}
              initial={reduce ? false : { strokeDasharray: `0 ${c}` }}
              animate={{ strokeDasharray: `${a.len} ${c}`, strokeWidth: hover === a.i ? stroke + 5 : stroke, opacity: hover !== null && hover !== a.i ? 0.4 : 1 }}
              transition={{ strokeDasharray: { duration: 0.75, ease: EASE, delay: reduce ? 0 : 0.08 + (a.offset / c) * 0.7 }, default: { duration: 0.2 } }}
              onPointerEnter={() => setHover(a.i)}
              onPointerLeave={() => setHover(null)}
              style={{ cursor: "default" }}
            />
          ) : null,
        )}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
        <span className="max-w-full truncate font-semibold leading-none tracking-[-0.02em] tabular-nums" style={{ fontSize: Math.max(15, size * 0.17) }}>
          {typeof centerValue === "number" ? <CountUp value={centerValue} format={(v) => fmtNum(v, hovered ? unit : undefined)} /> : centerValue}
        </span>
        {centerLabel && <span className="mt-1 max-w-full truncate text-[11.5px] text-ink-3">{centerLabel}</span>}
      </div>
    </div>
  );

  if (!legend) return <div className={className}>{chart}</div>;
  return (
    <div className={`flex w-full min-w-0 items-center gap-5 ${legend === "below" ? "flex-col" : ""} ${className}`}>
      {chart}
      <ul className={`min-w-0 flex-1 ${legend === "below" ? "w-full" : ""}`}>
        {segments.map((s, i) => (
          <li
            key={i}
            data-clamp
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            className={`flex items-center gap-2 rounded-[8px] px-1.5 py-[3px] text-[13px] transition ${hover === i ? "bg-gray-100" : ""}`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-ink-2">{s.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{fmtNum(s.value, unit)}</span>
            <span className="w-9 shrink-0 text-right text-[11.5px] tabular-nums text-ink-3">{total ? `${Math.round((s.value / total) * 100)}%` : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Concentric rings, outermost first, each filling toward its target. */
export function Rings({
  items,
  size = 150,
  className = "",
}: {
  items: { label: string; value: number; target: number; color: string }[];
  size?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const n = items.length;
  const stroke = Math.max(8, Math.min(16, (size / 2 - 14) / (n * 1.25)));
  const step = stroke + 3;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={`-rotate-90 shrink-0 ${className}`} role="img" aria-label={items.map((it) => `${it.label} ${it.value} of ${it.target}`).join(", ")}>
      {items.map((it, i) => {
        const r = size / 2 - stroke / 2 - 2 - i * step;
        if (r <= stroke / 2) return null;
        const pct = Math.max(0, Math.min(1, it.value / it.target));
        return (
          <g key={i}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tint(it.color, 16)} strokeWidth={stroke} />
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={it.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: pct === 0 ? 0.0001 : pct }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.1 + i * 0.12 }}
              style={{ opacity: pct === 0 ? 0 : 1 }}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** Labelled bars toward a target; the fill passes the end with a check when reached. */
export function ProgressBars({
  items,
  compact = true,
  className = "",
}: {
  items: { label: string; value: number; target: number; color: string; unit?: string; icon?: string }[];
  compact?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <ul className={`flex flex-col ${compact ? "gap-2.5" : "gap-4"} ${className}`}>
      {items.map((it, i) => {
        const pct = Math.max(0, Math.min(1, it.value / it.target));
        const done = it.value >= it.target;
        return (
          <li key={i} data-clamp>
            <div className={`mb-1 flex items-baseline gap-2 ${compact ? "text-[13px]" : "text-[14.5px]"}`}>
              {it.icon && <span className="shrink-0">{it.icon}</span>}
              <span className="min-w-0 flex-1 truncate text-ink-2">{it.label}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold text-ink">{fmtNum(it.value)}</span>
                <span className="text-ink-3">
                  {" "}
                  / {fmtNum(it.target, it.unit)}
                </span>
              </span>
              {done && <span className="text-[11px] font-semibold text-success">✓</span>}
            </div>
            <div className={`relative overflow-hidden rounded-full ${compact ? "h-[7px]" : "h-[9px]"}`} style={{ background: tint(it.color, 16) }}>
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: it.color }}
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${pct * 100}%` }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.08 + i * 0.07 }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
