"use client";

import { useId, useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { EASE, Tooltip, fmtNum, labelEvery, niceTicks, useHover, useSize } from "./core";

export type LineSeries = { name: string; values: (number | null)[]; color: string };

/**
 * Lines over a shared x axis. The line draws itself in, the area fades up,
 * and a crosshair with a tooltip follows the pointer. Nulls break the line.
 * Fills its container's height unless `height` is given.
 */
export function LineChart({
  series,
  labels,
  unit,
  area,
  goal,
  height,
  axes: axesProp = true,
  yMin,
  yMax,
  className = "",
}: {
  series: LineSeries[];
  labels: string[];
  unit?: string;
  area?: boolean;
  goal?: { value: number; label?: string };
  height?: number;
  axes?: boolean;
  yMin?: number;
  yMax?: number;
  className?: string;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  const reduce = useReducedMotion();
  const { tip, setTip, active, setActive, clear } = useHover();
  const gid = `lc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const n = Math.max(...series.map((s) => s.values.length), 1);
  const w = size.width;
  const h = height ?? size.height;
  // Short charts drop their axes rather than cram them.
  const axes = axesProp && h >= 72;
  const showArea = area ?? series.length === 1;

  const geo = useMemo(() => {
    const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
    if (goal) all.push(goal.value);
    const dataMin = Math.min(yMin ?? Infinity, ...all, all.length ? Infinity : 0);
    const dataMax = Math.max(yMax ?? -Infinity, ...all, all.length ? -Infinity : 1);
    // Lines don't need a zero baseline: when values sit far from zero, frame them.
    const floorAtZero = yMin !== undefined ? yMin <= 0 : dataMin <= 0 || dataMin < dataMax * 0.45;
    const rawLo = floorAtZero ? Math.min(0, dataMin) : dataMin - (dataMax - dataMin) * 0.25;
    const tickCount = h - 28 < 56 ? 2 : h - 28 < 110 ? 3 : 4;
    const span = niceTicks(dataMax - rawLo || 1, tickCount);
    const step = span[1] - span[0];
    const bottom = floorAtZero ? Math.min(0, Math.floor(dataMin / step) * step) : Math.floor(rawLo / step) * step;
    const ticks: number[] = [];
    for (let t = bottom; t <= dataMax + step * 0.999 && ticks.length < 8; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
    if (ticks.length < 2) ticks.push(bottom + step);
    const top = ticks.at(-1)!;
    const padL = axes ? Math.max(22, String(fmtNum(top)).length * 6.5 + 8) : 2;
    const padB = axes ? 20 : 2;
    const padT = 8;
    const padR = 6;
    const iw = Math.max(1, w - padL - padR);
    const ih = Math.max(1, h - padT - padB);
    const x = (i: number) => padL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (v: number) => padT + ih - ((v - bottom) / (top - bottom || 1)) * ih;
    const paths = series.map((s) => {
      let d = "";
      let pen = false;
      s.values.forEach((v, i) => {
        if (v === null) {
          pen = false;
          return;
        }
        d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        pen = true;
      });
      const pts = s.values.map((v, i) => (v === null ? null : i)).filter((i): i is number => i !== null);
      const base = y(Math.max(bottom, Math.min(0, top)));
      const fill = pts.length > 1 ? `${d}L${x(pts.at(-1)!).toFixed(1)},${base}L${x(pts[0]).toFixed(1)},${base}Z` : "";
      const last = pts.length ? pts.at(-1)! : null;
      return { d, fill, last };
    });
    return { ticks, padL, padB, padT, iw, ih, x, y, paths, bottom };
  }, [series, goal, w, h, n, axes, yMin, yMax]);

  const every = labelEvery(n, geo.iw, 64);
  const ready = w > 0 && h > 0;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - 0) / Math.max(1, r.width)) * (n - 1))));
    setActive(i);
    const ys = series.map((s) => s.values[i]).filter((v): v is number => v !== null);
    setTip({
      x: geo.x(i),
      y: ys.length ? geo.y(Math.max(...ys)) : geo.padT + geo.ih / 2,
      title: labels[i],
      rows: series.map((s) => ({ color: s.color, label: s.name, value: fmtNum(s.values[i] ?? null, unit) })),
    });
  };

  return (
    <div ref={ref} className={`relative min-h-0 w-full ${height ? "" : "h-full"} ${className}`} style={height ? { height } : undefined}>
      {ready && (
        <svg width={w} height={h} className="block overflow-visible" role="img" aria-label={`${series.map((s) => s.name).join(", ")} over ${n} points`}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={i} id={`${gid}-${i}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {axes &&
            geo.ticks.map((t) => (
              <g key={t}>
                <line x1={geo.padL} x2={w - 6} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--gray-200)" strokeWidth={1} />
                <text x={geo.padL - 6} y={geo.y(t)} dy="0.32em" textAnchor="end" className="fill-gray-500 text-[10.5px] tabular-nums">
                  {fmtNum(t)}
                </text>
              </g>
            ))}
          {axes &&
            labels.slice(0, n).map((l, i) =>
              i % every === 0 || (i === n - 1 && (n - 1) % every > every / 2) ? (
                <text key={i} x={geo.x(i)} y={h - 4} textAnchor={i === 0 && n > 1 ? "start" : i === n - 1 && n > 1 ? "end" : "middle"} className="fill-gray-500 text-[10.5px]">
                  {l}
                </text>
              ) : null,
            )}
          {goal && (
            <g>
              <line x1={geo.padL} x2={w - 6} y1={geo.y(goal.value)} y2={geo.y(goal.value)} stroke="var(--gray-400)" strokeWidth={1} strokeDasharray="3 4" />
              {goal.label && (
                <text x={geo.padL + 4} y={geo.y(goal.value) - 5} textAnchor="start" className="fill-gray-500 text-[10.5px] font-medium">
                  {goal.label} {fmtNum(goal.value, unit)}
                </text>
              )}
            </g>
          )}
          {geo.paths.map((p, i) =>
            showArea && p.fill ? (
              <motion.path
                key={`a${i}-${n}`}
                d={p.fill}
                fill={`url(#${gid}-${i})`}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1, d: p.fill }}
                transition={{ opacity: { duration: 0.8, delay: 0.35 }, d: { duration: 0.6, ease: EASE } }}
              />
            ) : null,
          )}
          {geo.paths.map((p, i) => (
            <motion.path
              key={`l${i}-${n}`}
              d={p.d}
              fill="none"
              stroke={series[i].color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1, d: p.d }}
              transition={{ pathLength: { duration: 1, ease: EASE, delay: i * 0.12 }, d: { duration: 0.6, ease: EASE } }}
            />
          ))}
          {geo.paths.map((p, i) =>
            p.last !== null && active === null ? (
              <motion.circle
                key={`e${i}-${n}`}
                cx={geo.x(p.last)}
                cy={geo.y(series[i].values[p.last]!)}
                r={4}
                fill={series[i].color}
                stroke="white"
                strokeWidth={2}
                initial={reduce ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.95 + i * 0.12, type: "spring", stiffness: 500, damping: 22 }}
              />
            ) : null,
          )}
          {active !== null && (
            <g pointerEvents="none">
              <line x1={geo.x(active)} x2={geo.x(active)} y1={geo.padT} y2={geo.padT + geo.ih} stroke="var(--gray-300)" strokeWidth={1} />
              {series.map((s, i) =>
                s.values[active] !== null && s.values[active] !== undefined ? (
                  <circle key={i} cx={geo.x(active)} cy={geo.y(s.values[active]!)} r={4.5} fill={s.color} stroke="white" strokeWidth={2} />
                ) : null,
              )}
            </g>
          )}
          <rect
            x={geo.padL}
            y={0}
            width={geo.iw}
            height={h}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={clear}
          />
        </svg>
      )}
      <Tooltip tip={tip} width={w} />
    </div>
  );
}
