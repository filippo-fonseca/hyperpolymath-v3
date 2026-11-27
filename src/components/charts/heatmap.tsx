"use client";

import { motion, useReducedMotion } from "motion/react";
import { addDays, weekdayOf } from "@/lib/time";
import { Tooltip, fmtNum, shortDay, tint, useHover, useSize } from "./core";

const STEPS = [0, 28, 50, 75, 100];

/** Color step for a value: an empty cell, then four tints of the accent. */
function cellFill(v: number | null, max: number, color: string) {
  if (v === null) return "var(--gray-100)";
  if (v <= 0) return "var(--gray-150)";
  const k = Math.min(4, Math.max(1, Math.ceil((v / max) * 4)));
  return k === 4 ? color : tint(color, STEPS[k]);
}

/**
 * A calendar of days: weeks run left to right, Sunday on top. Cells fade in
 * column by column; hover shows the date and value. Sizes its cells to fit
 * the width (or height, in a short card).
 */
export function Heatmap({
  start,
  values,
  max,
  color,
  label = "",
  unit,
  maxCell = 16,
  className = "",
}: {
  start: string;
  values: (number | null)[];
  max?: number;
  color: string;
  label?: string;
  unit?: string;
  maxCell?: number;
  className?: string;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  const reduce = useReducedMotion();
  const { tip, setTip, active, setActive, clear } = useHover();
  const lead = weekdayOf(start);
  const weeks = Math.ceil((lead + values.length) / 7);
  const top = max ?? Math.max(1, ...values.map((v) => v ?? 0));
  const monthRow = 14;
  const gap = 3;
  const fromW = (size.width - (weeks - 1) * gap) / weeks;
  const fromH = size.height ? (size.height - monthRow - 6 * gap) / 7 : Infinity;
  const cell = Math.max(5, Math.floor(Math.min(maxCell, fromW, fromH)));
  const w = weeks * cell + (weeks - 1) * gap;
  const h = monthRow + 7 * cell + 6 * gap;

  const months: { x: number; text: string }[] = [];
  for (let wk = 0; wk < weeks; wk++) {
    const d = addDays(start, wk * 7 - lead);
    const prev = addDays(d, -7);
    if (wk === 0 ? Number(d.slice(8, 10)) <= 7 || weeks < 6 : d.slice(5, 7) !== prev.slice(5, 7)) months.push({ x: wk * (cell + gap), text: shortDay(d).split(" ")[0] });
  }

  return (
    <div ref={ref} className={`relative w-full ${className}`}>
      {size.width > 0 && (
        <svg width={w} height={h} className="block" role="img" aria-label={`${label || "Daily values"} heatmap from ${start}`}>
          {months.map((m, i) =>
            i === 0 || m.x - months[i - 1].x > 26 ? (
              <text key={i} x={m.x} y={10} className="fill-gray-500 text-[10.5px]">
                {m.text}
              </text>
            ) : null,
          )}
          {values.map((v, i) => {
            const pos = lead + i;
            const wk = Math.floor(pos / 7);
            const wd = pos % 7;
            return (
              <motion.rect
                key={i}
                x={wk * (cell + gap)}
                y={monthRow + wd * (cell + gap)}
                width={cell}
                height={cell}
                rx={Math.max(2, cell * 0.22)}
                fill={cellFill(v, top, color)}
                stroke={active === i ? "var(--ink)" : "none"}
                strokeWidth={1.5}
                initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: reduce ? 0 : (wk / weeks) * 0.7 + wd * 0.015 }}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                onPointerEnter={() => {
                  setActive(i);
                  setTip({
                    x: wk * (cell + gap) + cell / 2,
                    y: monthRow + wd * (cell + gap),
                    title: shortDay(addDays(start, i)),
                    rows: [{ label: label || "value", value: v === null ? "no data" : fmtNum(v, unit) }],
                  });
                }}
                onPointerLeave={clear}
              />
            );
          })}
        </svg>
      )}
      <Tooltip tip={tip} width={size.width} />
    </div>
  );
}

/** "Less ▢▢▢▢▢ More" key for a heatmap. */
export function HeatmapKey({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1 text-[11px] text-ink-3">
      Less
      {[0, 1, 2, 3, 4].map((k) => (
        <span key={k} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: k === 0 ? "var(--gray-150)" : k === 4 ? color : tint(color, STEPS[k]) }} />
      ))}
      More
    </div>
  );
}
