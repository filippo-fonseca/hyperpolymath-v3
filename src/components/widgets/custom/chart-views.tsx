"use client";

import type { ReactNode } from "react";
import type { Accent, BarPayload, BlocksPayload, DonutPayload, HeatmapPayload, LinePayload, ProgressPayload, WidgetSize } from "@/lib/widgets";
import { ACCENT_HEX, CountUp, Legend, SERIES_ORDER, axisLabels, fmtNum, seriesColors, useSize } from "@/components/charts/core";
import { LineChart } from "@/components/charts/line-chart";
import { BarChart, HBarChart } from "@/components/charts/bar-chart";
import { Donut, ProgressBars, Rings } from "@/components/charts/radial";
import { Heatmap, HeatmapKey } from "@/components/charts/heatmap";

// Renderers for the chart kinds. Compact (on a card) they fill the card's
// height and drop chrome as the card shrinks; expanded they get room, a
// legend and a data table, so values never live in color alone.

type ViewProps<P> = { p: P; compact: boolean; size?: WidgetSize };

function deltaClass(d?: string) {
  if (!d) return "";
  if (/^\s*\+/.test(d)) return "text-success";
  if (/^\s*[-−]/.test(d)) return "text-danger";
  return "text-gray-500";
}

/** Headline number above a chart. */
function Summary({ value, label, delta, compact }: { value: string | number; label?: string; delta?: string; compact: boolean }) {
  return (
    <div className={`flex min-w-0 flex-wrap items-baseline gap-x-2 ${compact ? "mb-1.5" : "mb-5"}`}>
      <span className={`font-light leading-none tracking-[-0.03em] tabular-nums ${compact ? "text-[28px]" : "text-[48px]"}`}>
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </span>
      {delta && <span className={`text-[13px] font-semibold ${deltaClass(delta)}`}>{delta}</span>}
      {label && <span className="text-[13px] text-ink-3">{label}</span>}
    </div>
  );
}

/** Values behind a chart, for reading exact numbers (and for screen readers). */
function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="group mt-8">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-gray-150 px-3 py-1.5 text-[12.5px] font-medium text-ink-2 transition hover:bg-gray-200 [&::-webkit-details-marker]:hidden">
        <span className="transition group-open:rotate-90">›</span> Show the numbers
      </summary>
      <div className="mt-3 max-h-[320px] overflow-auto rounded-[14px] shadow-ring">
        <table className="w-full text-left text-[13px]">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              {head.map((h, i) => (
                <th key={i} className={`px-3 py-2 text-[12px] font-semibold text-gray-500 ${i ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-gray-150">
                {r.map((c, j) => (
                  <td key={j} className={`px-3 py-1.5 ${j ? "text-right tabular-nums" : "text-ink-2"}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const big = (size?: WidgetSize) => size === "l" || size === "w";

export function LineView({ p, compact, size }: ViewProps<LinePayload>) {
  const n = Math.max(...p.series.map((s) => s.values.length));
  const labels = axisLabels(p, n);
  const colors = seriesColors(p.series, p.accent);
  const series = p.series.map((s, i) => ({ name: s.name, values: s.values, color: colors[i] }));
  const legend = p.series.length > 1 && (!compact || size !== "s") ? <Legend items={series.map((s) => ({ label: s.name, color: s.color }))} className={compact ? "mb-1.5" : "mb-4"} /> : null;
  if (compact) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {p.summary && size !== "s" && <Summary {...p.summary} compact />}
        {legend}
        <div className="min-h-[48px] flex-1">
          <LineChart series={series} labels={labels} unit={p.unit} area={p.area} goal={size === "s" ? undefined : p.goal} axes={size !== "s"} />
        </div>
      </div>
    );
  }
  return (
    <div>
      {p.summary && <Summary {...p.summary} compact={false} />}
      {legend}
      <LineChart series={series} labels={labels} unit={p.unit} area={p.area} goal={p.goal} height={320} />
      <DataTable head={["", ...series.map((s) => s.name)]} rows={labels.map((l, i) => [l, ...series.map((s) => fmtNum(s.values[i] ?? null, p.unit))])} />
    </div>
  );
}

export function BarView({ p, compact, size }: ViewProps<BarPayload>) {
  const n = Math.max(...p.series.map((s) => s.values.length));
  const labels = axisLabels(p, n);
  const colors = seriesColors(p.series, p.accent);
  const series = p.series.map((s, i) => ({ name: s.name, values: s.values, color: colors[i] }));
  const table = <DataTable head={["", ...series.map((s) => s.name)]} rows={labels.map((l, i) => [l, ...series.map((s) => fmtNum(s.values[i] ?? null, p.unit))])} />;

  if (p.horizontal && series.length === 1) {
    const rows = labels.map((label, i) => ({ label, value: series[0].values[i] ?? 0 }));
    return (
      <div className={compact ? "@container" : ""}>
        <HBarChart rows={rows} unit={p.unit} color={series[0].color} />
        {!compact && table}
      </div>
    );
  }
  const legend = series.length > 1 && (!compact || size !== "s") ? <Legend items={series.map((s) => ({ label: s.name, color: s.color }))} className={compact ? "mb-1.5" : "mb-4"} /> : null;
  if (compact) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {legend}
        <div className="min-h-[48px] flex-1">
          <BarChart series={series} labels={labels} unit={p.unit} stacked={p.stacked} goal={size === "s" ? undefined : p.goal} axes={size !== "s"} highlightLast={!p.labels} />
        </div>
      </div>
    );
  }
  return (
    <div>
      {legend}
      <BarChart series={series} labels={labels} unit={p.unit} stacked={p.stacked} goal={p.goal} height={320} />
      {table}
    </div>
  );
}

function segmentColors(segments: { color?: Accent }[], accent?: Accent) {
  // One-hue donuts read as a single thing; parts get the categorical order, starting at the accent.
  const start = accent ? Math.max(0, SERIES_ORDER.indexOf(accent)) : 0;
  return segments.map((s, i) => ACCENT_HEX[s.color ?? (i < SERIES_ORDER.length ? SERIES_ORDER[(start + i) % SERIES_ORDER.length] : "gray")]);
}

export function DonutView({ p, compact, size }: ViewProps<DonutPayload>) {
  const [ref, box] = useSize<HTMLDivElement>();
  const colors = segmentColors(p.segments, p.accent);
  const segments = p.segments.map((s, i) => ({ label: s.label, value: s.value, color: colors[i] }));
  if (!compact) {
    return (
      <div>
        <Donut segments={segments} center={p.center} unit={p.unit} size={240} className="max-sm:flex-col" />
        <DataTable head={["", "Value", "Share"]} rows={segments.map((s) => [s.label, fmtNum(s.value, p.unit), `${Math.round((s.value / (segments.reduce((a, x) => a + x.value, 0) || 1)) * 100)}%`])} />
      </div>
    );
  }
  const d = Math.max(56, Math.min(box.height || 120, size === "s" ? box.width : (box.width || 300) * 0.48, big(size) ? 280 : 150));
  return (
    <div ref={ref} className="flex h-full min-h-0 items-center">
      {box.width > 0 && <Donut segments={segments} center={p.center} unit={p.unit} size={d} legend={size !== "s"} />}
    </div>
  );
}

export function ProgressView({ p, compact, size }: ViewProps<ProgressPayload>) {
  const [ref, box] = useSize<HTMLDivElement>();
  const style = p.style ?? (p.items.length <= 4 ? "rings" : "bars");
  const items = p.items.map((it, i) => ({ ...it, color: ACCENT_HEX[it.color ?? (p.items.length === 1 ? (p.accent ?? "blue") : SERIES_ORDER[i % SERIES_ORDER.length])] }));
  if (style === "bars") return <ProgressBars items={items} compact={compact} />;
  const ringSize = compact ? Math.max(64, Math.min(box.height || 120, size === "s" ? box.width : (box.width || 300) * 0.5, big(size) ? 280 : 170)) : 220;
  const legend = (
    <ul className="min-w-0 flex-1">
      {items.map((it, i) => (
        <li key={i} data-clamp className={`flex items-center gap-2 ${compact ? "py-[3px] text-[13px]" : "py-1.5 text-[15px]"}`}>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: it.color }} />
          {it.icon && <span className="shrink-0">{it.icon}</span>}
          <span className="min-w-0 flex-1 truncate text-ink-2">{it.label}</span>
          <span className="shrink-0 tabular-nums">
            <span className="font-semibold">{fmtNum(it.value)}</span>
            <span className="text-ink-3">/{fmtNum(it.target, it.unit)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <div ref={ref} className={`flex min-w-0 items-center gap-5 ${compact ? "h-full min-h-0" : "max-sm:flex-col"}`}>
      {(!compact || box.width > 0) && <Rings items={items} size={ringSize} />}
      {(!compact || size !== "s") && legend}
    </div>
  );
}

export function HeatmapView({ p, compact, size }: ViewProps<HeatmapPayload>) {
  const color = ACCENT_HEX[p.accent ?? "green"];
  const total = p.values.reduce<number>((a, v) => a + (v ?? 0), 0);
  const active = p.values.filter((v) => (v ?? 0) > 0).length;
  const footer = (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-3">
      <span>
        <span className="font-semibold text-ink">{active}</span> of {p.values.length} days{p.label ? ` with ${p.label}` : ""}
        {p.max === 100 ? "" : ` · ${fmtNum(total)} total`}
      </span>
      <HeatmapKey color={color} />
    </div>
  );
  if (compact) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <HeatmapFill p={p} color={color} />
        </div>
        {size !== "s" && footer}
      </div>
    );
  }
  return (
    <div>
      <div className="overflow-x-auto">
        <Heatmap start={p.start} values={p.values} max={p.max} color={color} label={p.label} maxCell={18} />
      </div>
      {footer}
    </div>
  );
}

/** A heatmap that sizes its cells to the card's height as well as its width. */
function HeatmapFill({ p, color }: { p: HeatmapPayload; color: string }) {
  const [ref, box] = useSize<HTMLDivElement>();
  return (
    <div ref={ref} className="h-full w-full">
      {box.height > 0 && (
        <div style={{ height: box.height }}>
          <HeatmapSized p={p} color={color} height={box.height} />
        </div>
      )}
    </div>
  );
}

function HeatmapSized({ p, color, height }: { p: HeatmapPayload; color: string; height: number }) {
  // Show only the weeks that fit at a readable cell size, newest on the right.
  const [ref, box] = useSize<HTMLDivElement>();
  const cell = Math.max(6, Math.min(28, (height - 14 - 18) / 7));
  const weeksFit = Math.max(4, Math.floor((box.width + 3) / (cell + 3)));
  const days = Math.min(p.values.length, weeksFit * 7 - 6);
  const values = p.values.slice(-days);
  const startIdx = p.values.length - values.length;
  const d = new Date(`${p.start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + startIdx);
  return (
    <div ref={ref} className="h-full w-full">
      {box.width > 0 && <Heatmap start={d.toISOString().slice(0, 10)} values={values} max={p.max ?? Math.max(1, ...p.values.map((v) => v ?? 0))} color={color} label={p.label} maxCell={cell} />}
    </div>
  );
}

/** Bento: up to six blocks of other kinds, two per row. */
const FLOWING = new Set(["stat", "list", "markdown", "timeline", "table"]);

/** Grid rows for a bento: rows holding a chart share the spare height, text-only rows take what they need. */
function blockRows(blocks: BlocksPayload["blocks"]) {
  const rows: boolean[] = [];
  let col = 0;
  for (const b of blocks) {
    const wide = b.span === 2;
    if (wide || col === 0) rows.push(false);
    if (!FLOWING.has(b.kind)) rows[rows.length - 1] = true;
    col = wide ? 0 : (col + 1) % 2;
  }
  return rows.map((chart) => (chart ? "minmax(0,1fr)" : "auto")).join(" ");
}

export function BlocksView({ p, compact, render }: ViewProps<BlocksPayload> & { render: (b: BlocksPayload["blocks"][number], compact: boolean) => ReactNode }) {
  return (
    <div className={`grid grid-cols-2 gap-2 ${compact ? "h-full" : "gap-4"}`} style={compact ? { gridTemplateRows: blockRows(p.blocks) } : undefined}>
      {p.blocks.map((b, i) => (
        <section key={i} className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[16px] bg-gray-50 shadow-[inset_0_0_0_1px_rgb(20_20_20/0.04)] ${compact ? "p-2.5" : "p-4"} ${b.span === 2 ? "col-span-2" : ""}`}>
          {b.title && <h4 className="mb-1 truncate text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gray-500">{b.title}</h4>}
          <div className="min-h-0 flex-1">{render(b, compact)}</div>
        </section>
      ))}
    </div>
  );
}
