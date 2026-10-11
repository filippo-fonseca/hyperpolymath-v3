"use client";

import { motion } from "motion/react";

/** Progress ring: gray track, accent arc with round caps. `value` is 0..1. */
export function Ring({
  size,
  stroke,
  value,
  children,
  muted = false,
}: {
  size: number;
  stroke: number;
  value: number;
  children?: React.ReactNode;
  muted?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gray-150)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={muted ? "var(--gray-300)" : "var(--accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - v), opacity: v === 0 ? 0 : 1 }}
          transition={{ type: "spring", duration: 0.5, bounce: 0 }}
        />
      </svg>
      {children !== undefined && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
    </span>
  );
}
