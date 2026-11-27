"use client";

import { useId, useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { encode } from "uqr";

/**
 * A QR code drawn as soft rounded dots with rounded finder eyes, revealed by
 * a growing circle. Rendered from the matrix (no innerHTML), so it themes
 * with currentColor.
 */
export function QrCode({ value, size = 220, label }: { value: string; size?: number; label: string }) {
  const clip = useId();
  const reduce = useReducedMotion();
  const { data, n } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 0 });
    return { data: qr.data, n: qr.size };
  }, [value]);

  const inEye = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  const dots: { x: number; y: number }[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (data[y][x] && !inEye(x, y)) dots.push({ x, y });
  const eyes = [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ];
  const r = Math.hypot(n, n);

  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} width={size} height={size} role="img" aria-label={label} className="block">
      <defs>
        <clipPath id={clip}>
          <motion.circle
            cx={n / 2}
            cy={n / 2}
            initial={{ r: reduce ? r : 0 }}
            animate={{ r }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`} fill="currentColor">
        {dots.map(({ x, y }) => (
          <rect key={`${x}-${y}`} x={x + 0.09} y={y + 0.09} width={0.82} height={0.82} rx={0.36} />
        ))}
        {eyes.map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={1.9} fill="none" stroke="currentColor" strokeWidth={1} />
            <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.95} />
          </g>
        ))}
      </g>
    </svg>
  );
}
