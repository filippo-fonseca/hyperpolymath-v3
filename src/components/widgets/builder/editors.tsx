"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ACCENTS, validatePayload, type Accent, type CustomKind } from "@/lib/widgets";
import { ACCENT_HEX } from "@/components/charts/core";
import { fieldClass, Segmented } from "@/components/ui/primitives";
import { IconClose, IconPlus } from "@/components/ui/icons";

// Content editors for widgets you write yourself. Friendly forms for the
// common kinds and a JSON tab for everything (bento and heatmaps live
// there). Each form keeps its own text, so half-typed numbers don't jump.

type P = Record<string, unknown>;
type EditorProps = { payload: P; onChange: (p: P) => void };

const area = `${fieldClass} h-auto min-h-[96px] w-full resize-y py-2.5 leading-snug`;

function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <span className="text-[13px] font-medium text-ink-2">{children}</span>
      {hint && <span className="text-[11.5px] text-ink-3">{hint}</span>}
    </div>
  );
}

const numList = (s: string) =>
  s
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((x) => (x === "-" || x.toLowerCase() === "null" ? null : Number(x)))
    .filter((x) => x === null || Number.isFinite(x));

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const opt = (s: string) => (s.trim() ? s.trim() : undefined);
const clean = (o: P): P => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));

// List -----------------------------------------------------------------------

type Row = { text: string; url: string; meta: string; at: string; done: boolean | undefined; icon: string };

function ListEditor({ payload, onChange }: EditorProps) {
  const init = ((payload.items as P[] | undefined) ?? []).map((it) => ({
    text: String(it.text ?? ""),
    url: String(it.url ?? ""),
    meta: String(it.meta ?? ""),
    at: String(it.at ?? ""),
    done: it.done as boolean | undefined,
    icon: String(it.icon ?? ""),
  }));
  const [rows, setRows] = useState<Row[]>(init.length ? init : [{ text: "", url: "", meta: "", at: "", done: undefined, icon: "" }]);
  const checklist = rows.some((r) => r.done !== undefined);
  const emit = (next: Row[]) => {
    setRows(next);
    onChange({
      ...payload,
      items: next.filter((r) => r.text.trim()).map((r) => clean({ text: r.text.trim(), url: opt(r.url), meta: opt(r.meta), at: opt(r.at), done: r.done, icon: opt(r.icon) })),
    });
  };
  const set = (i: number, patch: Partial<Row>) => emit(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div>
      <Label hint={<button type="button" className="font-medium text-accent" onClick={() => emit(rows.map((r) => ({ ...r, done: checklist ? undefined : !!r.done })))}>{checklist ? "Plain list" : "Make it a checklist"}</button>}>
        Items
      </Label>
      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {rows.map((r, i) => (
            <motion.li key={i} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="rounded-[14px] bg-gray-50 p-2 shadow-[inset_0_0_0_1px_rgb(20_20_20/0.05)]">
              <div className="flex items-center gap-2">
                {checklist && (
                  <input type="checkbox" checked={!!r.done} onChange={(e) => set(i, { done: e.target.checked })} className="h-4 w-4 shrink-0 accent-[var(--accent)]" aria-label="Done" />
                )}
                <input value={r.icon} onChange={(e) => set(i, { icon: e.target.value })} placeholder="🙂" maxLength={4} className={`${fieldClass} h-9 w-11 shrink-0 px-0 text-center`} aria-label="Emoji" />
                <input value={r.text} onChange={(e) => set(i, { text: e.target.value })} placeholder="What it says" className={`${fieldClass} h-9 flex-1`} aria-label="Text" />
                <button type="button" onClick={() => emit(rows.filter((_, j) => j !== i))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-3 transition hover:bg-gray-150 hover:text-ink" aria-label="Remove item">
                  <IconClose size={15} />
                </button>
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5 pl-[52px] max-sm:pl-0">
                <input value={r.url} onChange={(e) => set(i, { url: e.target.value })} placeholder="Link (https://…)" className={`${fieldClass} h-8 text-[12.5px]`} aria-label="Link" />
                <input value={r.meta} onChange={(e) => set(i, { meta: e.target.value })} placeholder="Label" className={`${fieldClass} h-8 text-[12.5px]`} aria-label="Label" />
                <input type="date" value={r.at.slice(0, 10)} onChange={(e) => set(i, { at: e.target.value })} className={`${fieldClass} h-8 text-[12.5px]`} aria-label="Date" />
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <AddButton onClick={() => emit([...rows, { text: "", url: "", meta: "", at: "", done: checklist ? false : undefined, icon: "" }])}>Add item</AddButton>
    </div>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-accent transition hover:bg-accent-soft">
      <IconPlus size={15} /> {children}
    </button>
  );
}

// Stat -----------------------------------------------------------------------

function StatEditor({ payload, onChange }: EditorProps) {
  const [f, setF] = useState({
    value: String(payload.value ?? ""),
    prefix: String(payload.prefix ?? ""),
    unit: String(payload.unit ?? ""),
    label: String(payload.label ?? ""),
    delta: String(payload.delta ?? ""),
    target: payload.target !== undefined ? String(payload.target) : "",
    trend: ((payload.trend as number[] | undefined) ?? []).join(", "),
  });
  const emit = (next: typeof f) => {
    setF(next);
    const n = Number(next.value);
    onChange(
      clean({
        ...payload,
        value: next.value.trim() !== "" && Number.isFinite(n) ? n : next.value,
        prefix: opt(next.prefix),
        unit: opt(next.unit),
        label: opt(next.label),
        delta: opt(next.delta),
        target: next.target.trim() && Number.isFinite(Number(next.target)) ? Number(next.target) : undefined,
        trend: next.trend.trim() ? (numList(next.trend).filter((x) => x !== null) as number[]) : undefined,
      }),
    );
  };
  const input = (k: keyof typeof f, label: string, ph: string, cls = "") => (
    <label className={cls}>
      <Label>{label}</Label>
      <input value={f[k]} onChange={(e) => emit({ ...f, [k]: e.target.value })} placeholder={ph} className={`${fieldClass} w-full`} />
    </label>
  );
  return (
    <div className="grid grid-cols-6 gap-3">
      {input("prefix", "Before", "$", "col-span-1")}
      {input("value", "Number", "42", "col-span-3")}
      {input("unit", "Unit", "km", "col-span-2")}
      {input("label", "Caption", "Run this week", "col-span-6")}
      {input("delta", "Change", "+8%", "col-span-3")}
      {input("target", "Goal", "50", "col-span-3")}
      {input("trend", "Trend, oldest first", "21, 30, 26, 35", "col-span-6")}
    </div>
  );
}

// Markdown --------------------------------------------------------------------

function MarkdownEditor({ payload, onChange }: EditorProps) {
  return (
    <div>
      <Label hint="**bold**, _italic_, - lists, [links](https://…)">Note</Label>
      <textarea value={String(payload.markdown ?? "")} onChange={(e) => onChange({ ...payload, markdown: e.target.value })} className={`${area} min-h-[200px] font-[450]`} placeholder="Write anything" />
    </div>
  );
}

// Progress ---------------------------------------------------------------------

function ProgressEditor({ payload, onChange }: EditorProps) {
  type R = { label: string; value: string; target: string; unit: string; icon: string };
  const [rows, setRows] = useState<R[]>(
    ((payload.items as P[] | undefined) ?? []).map((it) => ({ label: String(it.label ?? ""), value: String(it.value ?? ""), target: String(it.target ?? ""), unit: String(it.unit ?? ""), icon: String(it.icon ?? "") })),
  );
  const emit = (next: R[]) => {
    setRows(next);
    onChange({
      ...payload,
      items: next
        .filter((r) => r.label.trim() && Number(r.target) > 0)
        .map((r) => clean({ label: r.label.trim(), value: Number(r.value) || 0, target: Number(r.target), unit: opt(r.unit), icon: opt(r.icon) })),
    });
  };
  const set = (i: number, patch: Partial<R>) => emit(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Label>Goals</Label>
        <Segmented size="sm" value={(payload.style as string) ?? "rings"} options={[{ value: "rings", label: "Rings" }, { value: "bars", label: "Bars" }]} onChange={(v) => onChange({ ...payload, style: v })} />
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <input value={r.icon} onChange={(e) => set(i, { icon: e.target.value })} placeholder="🎯" maxLength={4} className={`${fieldClass} h-9 w-11 shrink-0 px-0 text-center`} aria-label="Emoji" />
            <input value={r.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Swim" className={`${fieldClass} h-9 min-w-0 flex-[2]`} aria-label="Goal" />
            <input value={r.value} onChange={(e) => set(i, { value: e.target.value })} placeholder="3" inputMode="decimal" className={`${fieldClass} h-9 w-16 min-w-0 flex-1`} aria-label="Value" />
            <span className="text-ink-3">/</span>
            <input value={r.target} onChange={(e) => set(i, { target: e.target.value })} placeholder="5" inputMode="decimal" className={`${fieldClass} h-9 w-16 min-w-0 flex-1`} aria-label="Target" />
            <input value={r.unit} onChange={(e) => set(i, { unit: e.target.value })} placeholder="km" className={`${fieldClass} h-9 w-14 min-w-0 flex-1`} aria-label="Unit" />
            <button type="button" onClick={() => emit(rows.filter((_, j) => j !== i))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-gray-150 hover:text-ink" aria-label="Remove goal">
              <IconClose size={15} />
            </button>
          </li>
        ))}
      </ul>
      {rows.length < 8 && <AddButton onClick={() => emit([...rows, { label: "", value: "", target: "", unit: "", icon: "" }])}>Add goal</AddButton>}
    </div>
  );
}

// Charts (line and bar) ------------------------------------------------------------

function SeriesEditor({ payload, onChange, kind }: EditorProps & { kind: "line" | "bar" }) {
  type S = { name: string; values: string };
  const [series, setSeries] = useState<S[]>(((payload.series as P[] | undefined) ?? []).map((s) => ({ name: String(s.name ?? ""), values: ((s.values as unknown[]) ?? []).map((v) => (v === null ? "-" : String(v))).join(", ") })));
  const [axis, setAxis] = useState<"dates" | "labels">(payload.labels ? "labels" : "dates");
  const [labels, setLabels] = useState(((payload.labels as string[] | undefined) ?? []).join(", "));
  const emitAll = (s: S[], a = axis, l = labels, extra: P = {}) => {
    const next: P = { ...payload, ...extra, series: s.filter((x) => x.name.trim() || x.values.trim()).map((x) => ({ name: x.name.trim() || "Series", values: numList(x.values) })) };
    if (a === "labels") {
      next.labels = l.split(",").map((x) => x.trim()).filter(Boolean);
      delete next.start;
      delete next.step;
    } else {
      delete next.labels;
      next.start = (extra.start as string) ?? (payload.start as string) ?? new Date().toISOString().slice(0, 10);
      next.step = (extra.step as string) ?? (payload.step as string) ?? "day";
    }
    onChange(clean(next));
  };
  const set = (i: number, patch: Partial<S>) => {
    const next = series.map((s, j) => (j === i ? { ...s, ...patch } : s));
    setSeries(next);
    emitAll(next);
  };
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label hint="Numbers separated by commas; - for a gap">Series</Label>
        <ul className="flex flex-col gap-2">
          {series.map((s, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <input value={s.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Name" className={`${fieldClass} h-9 w-28 shrink-0`} aria-label="Series name" />
              <input value={s.values} onChange={(e) => set(i, { values: e.target.value })} placeholder="3, 4.5, 2, 5" className={`${fieldClass} h-9 min-w-0 flex-1 font-mono text-[12.5px]`} aria-label="Values" />
              <button
                type="button"
                onClick={() => {
                  const next = series.filter((_, j) => j !== i);
                  setSeries(next);
                  emitAll(next);
                }}
                className="flex h-9 w-8 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-gray-150 hover:text-ink"
                aria-label="Remove series"
              >
                <IconClose size={15} />
              </button>
            </li>
          ))}
        </ul>
        {series.length < 6 && (
          <AddButton
            onClick={() => {
              const next = [...series, { name: "", values: "" }];
              setSeries(next);
            }}
          >
            Add series
          </AddButton>
        )}
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Along the bottom</Label>
          <Segmented
            size="sm"
            value={axis}
            options={[
              { value: "dates", label: "Dates" },
              { value: "labels", label: "Labels" },
            ]}
            onChange={(v) => {
              setAxis(v);
              emitAll(series, v);
            }}
          />
        </div>
        {axis === "labels" ? (
          <input
            value={labels}
            onChange={(e) => {
              setLabels(e.target.value);
              emitAll(series, "labels", e.target.value);
            }}
            placeholder="Mon, Tue, Wed"
            className={`${fieldClass} w-full`}
          />
        ) : (
          <div className="flex gap-2">
            <input type="date" value={String(payload.start ?? "")} onChange={(e) => emitAll(series, "dates", labels, { start: e.target.value })} className={`${fieldClass} flex-1`} aria-label="First date" />
            <Segmented size="sm" className="self-center" value={(payload.step as "day" | "week" | "month") ?? "day"} options={[{ value: "day", label: "Daily" }, { value: "week", label: "Weekly" }, { value: "month", label: "Monthly" }]} onChange={(v) => emitAll(series, "dates", labels, { step: v })} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <Label>Unit</Label>
          <input value={String(payload.unit ?? "")} onChange={(e) => onChange(clean({ ...payload, unit: opt(e.target.value) }))} placeholder="h" className={`${fieldClass} w-full`} />
        </label>
        <label>
          <Label>Goal line</Label>
          <input
            defaultValue={payload.goal ? String((payload.goal as P).value) : ""}
            onChange={(e) => onChange(clean({ ...payload, goal: e.target.value.trim() && Number.isFinite(Number(e.target.value)) ? { value: Number(e.target.value), label: "Goal" } : undefined }))}
            placeholder="8"
            inputMode="decimal"
            className={`${fieldClass} w-full`}
          />
        </label>
      </div>
      {kind === "bar" && series.length > 1 && (
        <Segmented size="sm" value={payload.stacked ? "stacked" : "side"} options={[{ value: "stacked", label: "Stacked" }, { value: "side", label: "Side by side" }]} onChange={(v) => onChange({ ...payload, stacked: v === "stacked" })} />
      )}
      {kind === "bar" && series.length === 1 && (
        <Segmented size="sm" value={payload.horizontal ? "h" : "v"} options={[{ value: "v", label: "Columns" }, { value: "h", label: "Ranked rows" }]} onChange={(v) => onChange({ ...payload, horizontal: v === "h" })} />
      )}
    </div>
  );
}

// Donut, timeline, table, digest: one line per thing --------------------------------

function LinesEditor({ payload, onChange, kind }: EditorProps & { kind: "donut" | "timeline" | "table" | "digest" }) {
  const toText = (): string => {
    switch (kind) {
      case "donut":
        return ((payload.segments as P[]) ?? []).map((s) => `${s.label}: ${s.value}`).join("\n");
      case "timeline":
        return ((payload.events as P[]) ?? []).map((e) => `${e.time ?? e.at ?? ""} | ${e.text}`).join("\n");
      case "table":
        return [((payload.columns as string[]) ?? []).join(", "), ...((payload.rows as unknown[][]) ?? []).map((r) => r.map((c) => c ?? "").join(", "))].join("\n");
      case "digest":
        return ((payload.sections as P[]) ?? []).map((s) => [`# ${s.title}`, ...((s.items as P[]) ?? []).map((it) => `${it.text}${it.meta ? ` | ${it.meta}` : ""}`)].join("\n")).join("\n\n");
    }
  };
  const [text, setText] = useState(toText);
  const parse = (t: string): P => {
    switch (kind) {
      case "donut":
        return { ...payload, segments: lines(t).map((l) => { const m = l.match(/^(.*?)[:=]\s*(-?[\d.]+)\s*$/); return m ? { label: m[1].trim(), value: Math.max(0, Number(m[2])) } : null; }).filter(Boolean) };
      case "timeline":
        return {
          ...payload,
          events: lines(t).map((l) => {
            const [when, ...rest] = l.split("|");
            const text = rest.join("|").trim() || when.trim();
            const w = rest.length ? when.trim() : "";
            return /^\d{4}-\d{2}-\d{2}/.test(w) ? { at: w, text } : { time: w || "·", text };
          }),
        };
      case "table": {
        const [head, ...rows] = lines(t).map((l) => l.split(",").map((c) => c.trim()));
        return { ...payload, columns: head ?? ["Column"], rows: rows.map((r) => r.map((c) => (c === "" ? null : Number.isFinite(Number(c)) && /^-?[\d.]+$/.test(c) ? Number(c) : c))) };
      }
      case "digest": {
        const sections: { title: string; items: P[] }[] = [];
        for (const l of lines(t)) {
          if (l.startsWith("#")) sections.push({ title: l.replace(/^#+\s*/, ""), items: [] });
          else {
            if (!sections.length) sections.push({ title: "", items: [] });
            const [txt, meta] = l.split("|").map((x) => x.trim());
            sections.at(-1)!.items.push(clean({ text: txt, meta: opt(meta ?? "") }));
          }
        }
        return { ...payload, sections };
      }
    }
  };
  const hint = {
    donut: "One part per line: School: 18",
    timeline: "One event per line: 9am | Standup  (or 2026-11-28T09:00:00Z | …)",
    table: "First line is the header. Commas between cells.",
    digest: "# Section title, then one item per line. Add | label for a trailing label.",
  }[kind];
  return (
    <div className="flex flex-col gap-3">
      {kind === "digest" && (
        <label>
          <Label>Summary</Label>
          <textarea value={String(payload.summary ?? "")} onChange={(e) => onChange(clean({ ...payload, summary: opt(e.target.value) }))} className={`${area} min-h-[64px]`} placeholder="One or two sentences on top" />
        </label>
      )}
      <label>
        <Label hint={hint}>{kind === "table" ? "Rows" : kind === "donut" ? "Parts" : kind === "timeline" ? "Events" : "Sections"}</Label>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onChange(parse(e.target.value));
          }}
          className={`${area} min-h-[180px] font-mono text-[12.5px]`}
          spellCheck={false}
        />
      </label>
    </div>
  );
}

// JSON --------------------------------------------------------------------------

export function JsonEditor({ kind, payload, onChange }: EditorProps & { kind: CustomKind }) {
  const [text, setText] = useState(() => JSON.stringify(payload, null, 2));
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Label hint="Same shape your bots publish">JSON</Label>
      <textarea
        value={text}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value);
            const r = validatePayload(kind, parsed);
            setError(r.ok ? null : r.error);
            if (r.ok) onChange(parsed);
          } catch {
            setError("Not valid JSON yet.");
          }
        }}
        className={`${area} min-h-[300px] font-mono text-[12px] leading-[1.5] ${error ? "ring-danger/40" : ""}`}
      />
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1.5 text-[12.5px] text-[#d61a2f]">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Accent swatches every kind shares. */
export function AccentPicker({ value, onChange }: { value?: Accent; onChange: (a: Accent | undefined) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => onChange(undefined)} className={`h-7 rounded-full px-2.5 text-[12px] font-medium transition ${!value ? "bg-ink text-white" : "bg-gray-150 text-ink-2 hover:bg-gray-200"}`}>
        Auto
      </button>
      {ACCENTS.map((a) => (
        <button
          key={a}
          type="button"
          aria-label={a}
          title={a}
          onClick={() => onChange(a)}
          className="relative h-7 w-7 rounded-full transition active:scale-90"
          style={{ background: ACCENT_HEX[a] }}
        >
          {value === a && <motion.span layoutId="accent-ring" className="absolute -inset-[3px] rounded-full ring-2" style={{ ["--tw-ring-color" as string]: ACCENT_HEX[a] }} transition={{ type: "spring", duration: 0.3, bounce: 0.2 }} />}
        </button>
      ))}
    </div>
  );
}

/** True when the kind has a friendly form (otherwise JSON only). */
export const hasForm = (k: CustomKind) => !["heatmap", "blocks"].includes(k);

export function FormEditor({ kind, payload, onChange }: EditorProps & { kind: CustomKind }) {
  switch (kind) {
    case "list":
      return <ListEditor payload={payload} onChange={onChange} />;
    case "stat":
      return <StatEditor payload={payload} onChange={onChange} />;
    case "markdown":
      return <MarkdownEditor payload={payload} onChange={onChange} />;
    case "progress":
      return <ProgressEditor payload={payload} onChange={onChange} />;
    case "line":
    case "bar":
      return <SeriesEditor payload={payload} onChange={onChange} kind={kind} />;
    case "donut":
    case "timeline":
    case "table":
    case "digest":
      return <LinesEditor payload={payload} onChange={onChange} kind={kind} />;
    default:
      return <JsonEditor kind={kind} payload={payload} onChange={onChange} />;
  }
}
