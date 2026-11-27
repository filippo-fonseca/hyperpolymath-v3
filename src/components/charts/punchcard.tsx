"use client";

import { motion, useReducedMotion } from "motion/react";
import { Tooltip, fmtNum, useHover, useSize } from "./core";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hour = (h: number) => `${h % 12 || 12}${h < 12 ? "a" : "p"}`;
const hourLong = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;

/**
 * A weekday x hour punchcard: one dot per slot, its area proportional to the
 * count. Dots pop in hour by hour; hovering one names the slot. Weeks start
 * on Monday here because that reads like a working week.
 */
export function Punchcard({
  grid,
  color,
  unit = "done",
  className = "",
}: {
  /** 7 rows (Sunday first, as stored) of 24 hourly counts. */
  grid: number[][];
  color: string;
  unit?: string;
  className?: string;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  const reduce = useReducedMotion();
  const { tip, setTip, active, setActive, clear } = useHover();
  const order = [1, 2, 3, 4, 5, 6, 0];
  const max = Math.max(1, ...grid.flat());
  const padL = 34;
  const padB = 18;
  const cw = Math.max(8, (size.width - padL) / 24);
  const row = Math.min(30, Math.max(18, cw * 1.05));
  const h = row * 7 + padB;
  const rMax = Math.min(cw, row) / 2 - 1.5;
  const step = cw < 16 ? 6 : 3;

  return (
    <div ref={ref} className={`relative w-full ${className}`}>
      {size.width > 0 && (
        <svg width={size.width} height={h} className="block" role="img" aria-label="Tasks completed by weekday and hour">
          {order.map((d, ri) => (
            <g key={d}>
              <text x={0} y={ri * row + row / 2 + 4} className="fill-gray-500 text-[11px]">
                {DAYS[d]}
              </text>
              <line x1={padL} x2={size.width} y1={ri * row + row / 2} y2={ri * row + row / 2} stroke="var(--gray-150)" />
              {grid[d].map((v, hr) => {
                const key = d * 24 + hr;
                const cx = padL + hr * cw + cw / 2;
                const cy = ri * row + row / 2;
                const r = v > 0 ? Math.max(2, Math.sqrt(v / max) * rMax) : 0;
                return (
                  <g key={hr}>
                    {r > 0 && (
                      <motion.circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill={color}
                        initial={reduce ? false : { scale: 0, opacity: 0 }}
                        animate={{
                          scale: active === key ? 1.25 : 1,
                          opacity: active !== null && active !== key ? 0.45 : 0.35 + 0.65 * (v / max),
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 22,
                          delay: reduce || active !== null ? 0 : hr * 0.02 + ri * 0.03,
                        }}
                        style={{
                          transformBox: "fill-box",
                          transformOrigin: "center",
                        }}
                      />
                    )}
                    <rect
                      x={cx - cw / 2}
                      y={cy - row / 2}
                      width={cw}
                      height={row}
                      fill="transparent"
                      onPointerEnter={() => {
                        setActive(key);
                        setTip({
                          x: cx,
                          y: cy,
                          title: `${DAYS[d]} ${hourLong(hr)}`,
                          rows: [{ color, label: unit, value: fmtNum(v) }],
                        });
                      }}
                      onPointerLeave={clear}
                    />
                  </g>
                );
              })}
            </g>
          ))}
          {Array.from({ length: 24 }, (_, hr) =>
            hr % step === 0 ? (
              <text key={hr} x={padL + hr * cw + cw / 2} y={h - 4} textAnchor="middle" className="fill-gray-500 text-[10.5px]">
                {hour(hr)}
              </text>
            ) : null,
          )}
        </svg>
      )}
      <Tooltip tip={tip} width={size.width} />
    </div>
  );
}
