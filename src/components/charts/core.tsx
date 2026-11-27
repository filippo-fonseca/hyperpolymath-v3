"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Accent } from "@/lib/widgets";
import { addDays } from "@/lib/time";

// Shared chart plumbing: the palette, sizing, number and axis formatting, the
// tooltip, and a count-up number. Charts are hand-built SVG (no chart
// library): thin marks, recessive axes, a hover layer on everything.

/** Named accents. Text never wears these; they color marks only. */
export const ACCENT_HEX: Record<Accent, string> = {
  blue: "#1084fe",
  green: "#2fb26b",
  red: "#f2484b",
  orange: "#f08a24",
  yellow: "#e2ad00",
  purple: "#8a63f2",
  pink: "#ec4f9a",
  teal: "#14a3a8",
  gray: "#a3a3a3",
};

/**
 * Fixed categorical order for multi-series charts (validated for colorblind
 * separation between neighbors). A series keeps its slot; never cycled past six.
 */
export const SERIES_ORDER: Accent[] = ["blue", "green", "purple", "teal", "orange", "pink"];

export function seriesColors(series: { color?: Accent }[], accent?: Accent): string[] {
  if (series.length === 1) return [ACCENT_HEX[series[0].color ?? accent ?? "blue"]];
  return series.map((s, i) => ACCENT_HEX[s.color ?? SERIES_ORDER[i % SERIES_ORDER.length]]);
}

/** Tint of a color toward white, for heatmap steps and soft tracks. */
export const tint = (hex: string, pct: number) => `color-mix(in srgb, ${hex} ${pct}%, white)`;

/** Element size, kept current with a ResizeObserver. */
export function useSize<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    if (!el) return;
    const read = () => setSize((s) => (s.width === el.clientWidth && s.height === el.clientHeight ? s : { width: el.clientWidth, height: el.clientHeight }));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, size] as const;
}

/** 1,284 / 12.9K / 4.2M, with up to one decimal for small fractional values. */
export function fmtNum(v: number | null | undefined, unit = ""): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  const abs = Math.abs(v);
  let s: string;
  if (abs >= 1_000_000) s = `${trim(v / 1_000_000)}M`;
  else if (abs >= 10_000) s = `${trim(v / 1000)}K`;
  else if (Number.isInteger(v)) s = v.toLocaleString("en-US");
  else s = (Math.round(v * 10) / 10).toLocaleString("en-US");
  return unit ? (unit === "%" || unit.length <= 2 ? `${s}${unit}` : `${s} ${unit}`) : s;
}
const trim = (n: number) => (Math.round(n * 10) / 10).toString();

/** Round ticks from 0 to just above max: 3 to 5 clean steps. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => Math.round(i * step * 1e6) / 1e6);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Short label for a local date: "Nov 27". */
export function shortDay(date: string) {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
}

/** Labels for each x position: given, or generated from a start date and a step. */
export function axisLabels(p: { labels?: string[]; start?: string; step?: "day" | "week" | "month" }, n: number): string[] {
  if (p.labels) return Array.from({ length: n }, (_, i) => p.labels![i] ?? "");
  if (p.start) {
    return Array.from({ length: n }, (_, i) => {
      if (p.step === "month") {
        const y = Number(p.start!.slice(0, 4));
        const m = Number(p.start!.slice(5, 7)) - 1 + i;
        return `${MONTHS[((m % 12) + 12) % 12]}${m >= 12 || m < 0 ? ` ${y + Math.floor(m / 12)}` : ""}`;
      }
      const d = addDays(p.start!, p.step === "week" ? i * 7 : i);
      return p.step === "week" ? `Wk of ${shortDay(d)}` : shortDay(d);
    });
  }
  return Array.from({ length: n }, (_, i) => String(i + 1));
}

/** Which x labels to print so they never collide: about one per `px` pixels. */
export function labelEvery(n: number, width: number, px = 56) {
  const fit = Math.max(1, Math.floor(width / px));
  return Math.max(1, Math.ceil(n / fit));
}

// Tooltip ---------------------------------------------------------------------

export type TipRow = { color?: string; label: string; value: string };
export type Tip = { x: number; y: number; title?: string; rows: TipRow[] } | null;

/** A small card that follows the pointer inside its chart, flipping at the edges. */
export function Tooltip({ tip, width }: { tip: Tip; width: number }) {
  return (
    <AnimatePresence>
      {tip && (
        <motion.div
          key="tip"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1, left: tip.x > width * 0.6 ? tip.x - 12 : tip.x + 12, top: tip.y }}
          exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
          transition={{ type: "spring", stiffness: 520, damping: 40, mass: 0.6 }}
          className="pointer-events-none absolute z-10 min-w-[120px] max-w-[220px] rounded-[12px] bg-white/95 px-3 py-2 text-[12px] shadow-pop backdrop-blur"
          style={{ translateX: tip.x > width * 0.6 ? "-100%" : "0%", translateY: "-50%" }}
        >
          {tip.title && <div className="mb-1 font-semibold text-ink">{tip.title}</div>}
          {tip.rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2 py-px">
              {r.color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />}
              <span className="min-w-0 flex-1 truncate text-ink-2">{r.label}</span>
              <span className="font-semibold tabular-nums text-ink">{r.value}</span>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Legend: a swatch beside each name. Text stays ink; the swatch carries identity. */
export function Legend({ items, className = "" }: { items: { label: string; color: string; value?: string }[]; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-ink-2 ${className}`}>
      {items.map((it, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: it.color }} />
          <span className="truncate">{it.label}</span>
          {it.value && <span className="font-semibold tabular-nums text-ink">{it.value}</span>}
        </span>
      ))}
    </div>
  );
}

// Count-up --------------------------------------------------------------------

/** A number that counts up to its value on mount and glides between values. */
export function CountUp({ value, format = (v) => fmtNum(v), duration = 0.9, className }: { value: number; format?: (v: number) => string; duration?: number; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const decimals = Number.isInteger(value) ? 0 : 1;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = format(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = format(decimals ? Math.round(v * 10) / 10 : Math.round(v));
      },
    });
    from.current = value;
    return () => controls.stop();
  }, [value, duration, format, reduce, decimals]);
  return (
    <span ref={ref} className={className}>
      {format(reduce ? value : 0)}
    </span>
  );
}

// Environment -----------------------------------------------------------------

/** Timezone and clock for formatting `at` fields; the dashboard provides real ones. */
type Env = { tz: string; nowMs: number; animate: boolean };
const EnvCtx = createContext<Env | null>(null);

export function ChartEnv({ tz, nowMs, animate = true, children }: { tz: string; nowMs: number; animate?: boolean; children: ReactNode }) {
  return <EnvCtx value={{ tz, nowMs, animate }}>{children}</EnvCtx>;
}

const UTC_ENV: Env = { tz: "UTC", nowMs: 0, animate: true };

let browserEnv: Env | null = null;
const noSubscribe = () => () => {};

/** The surrounding ChartEnv; without one, the browser's zone and clock (UTC on the server). */
export function useChartEnv(): Env {
  const env = useContext(EnvCtx);
  const fallback = useSyncExternalStore(
    noSubscribe,
    () => (browserEnv ??= { tz: Intl.DateTimeFormat().resolvedOptions().timeZone, nowMs: Date.now(), animate: true }),
    () => UTC_ENV,
  );
  return env ?? fallback;
}

/** Hover state for a chart: a tooltip plus the index under the pointer. */
export function useHover() {
  const [tip, setTip] = useState<Tip>(null);
  const [active, setActive] = useState<number | null>(null);
  const clear = useCallback(() => {
    setTip(null);
    setActive(null);
  }, []);
  return { tip, setTip, active, setActive, clear };
}

export const EASE = [0.22, 1, 0.36, 1] as const;
