"use client";

import { SIZE_LABELS, WIDGET_SIZES, type WidgetSize } from "@/lib/widgets";

// Each size drawn on a desktop-width strip of the grid (8 columns, 4 rows),
// so wide reads as wide and large as square.
const SPAN: Record<WidgetSize, [cols: number, rows: number]> = { s: [2, 2], m: [4, 2], l: [4, 4], w: [8, 3] };

export function SizeGlyph({ size, active = false }: { size: WidgetSize; active?: boolean }) {
  const [c, r] = SPAN[size];
  const cell = 5;
  const gap = 1.5;
  return (
    <svg width={8 * cell + 7 * gap} height={4 * cell + 3 * gap} aria-hidden className="shrink-0">
      {Array.from({ length: 32 }, (_, i) => {
        const x = i % 8;
        const y = Math.floor(i / 8);
        const on = x < c && y < r;
        return (
          <rect
            key={i}
            x={x * (cell + gap)}
            y={y * (cell + gap)}
            width={cell}
            height={cell}
            rx={1.2}
            fill={on ? (active ? "var(--accent)" : "var(--gray-600)") : "var(--gray-200)"}
          />
        );
      })}
    </svg>
  );
}

/** Four tiles, each with a small picture of how much of the grid the size takes. */
export function SizePicker({ value, onChange }: { value: WidgetSize; onChange: (s: WidgetSize) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Widget size">
      {WIDGET_SIZES.map((s) => {
        const active = s === value;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(s)}
            className={`flex flex-col items-center gap-2 rounded-[14px] px-1 pb-2 pt-3 text-[12.5px] font-medium transition ${
              active ? "bg-accent-soft text-accent-hover shadow-[inset_0_0_0_1.5px_var(--accent)]" : "bg-gray-100 text-ink-2 hover:bg-gray-150"
            }`}
          >
            <SizeGlyph size={s} active={active} />
            {SIZE_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}
