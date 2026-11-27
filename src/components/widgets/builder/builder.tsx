"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import type { WidgetRow } from "@/lib/dashboard-types";
import { CUSTOM_KINDS, KIND_INFO, defaultSizeFor, isCustomKind, validatePayload, type Accent, type CustomKind, type WidgetSize } from "@/lib/widgets";
import { DEFAULT_DAYS, SOURCE_IDS, SOURCE_INFO, type SourceId, type WidgetSource } from "@/lib/widget-sources";
import { createWidgetAction, previewSourceAction, publishWidgetAction, updateWidgetAction, type WidgetPatch } from "@/app/actions/widgets";
import { useDashboard } from "@/components/dashboard/context";
import { SizePicker } from "@/components/dashboard/size-picker";
import { selectClass, selectStyle } from "@/components/teammates/form";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { Button, CloseButton, Segmented, fieldClass, useEscape, useFocusTrap, useMediaQuery, useScrollLock } from "@/components/ui/primitives";
import { IconBolt, IconCheck, IconCopy, IconMic, IconPencil, IconSparkle } from "@/components/ui/icons";
import { KiwiWaiting } from "@/components/illustrations";
import { ChartEnv, useSize } from "@/components/charts/core";
import { AccentPicker, FormEditor, JsonEditor, hasForm } from "./editors";
import { PreviewCard, cardPixels } from "./preview-card";
import { useDictation } from "./use-dictation";

// The widget builder. Three ways to fill a widget, one standard shape:
//   Live  - the app draws it from your own data (tasks, habits, bots).
//   Write - you type the content, with a live preview.
//   Ask   - you describe it (or say it) and hand it to a bot, which picks
//           the best kind and keeps it current.
// The preview is the real card at true scale, so what you see is what lands.

type Mode = "live" | "write" | "ask";
type Payload = Record<string, unknown>;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const BOT_CHOICE = "auto" as const;

const MODES: { id: Mode; title: string; text: string; icon: ReactNode }[] = [
  { id: "live", title: "Live data", text: "Charts of your own tasks, habits and bots.", icon: <IconBolt size={18} /> },
  { id: "write", title: "Write it", text: "Pick a look and type the content.", icon: <IconPencil size={18} /> },
  { id: "ask", title: "Ask a bot", text: "Describe it, or say it. A bot fills it.", icon: <IconSparkle size={18} /> },
];

function initialMode(w: WidgetRow | null, asked?: Mode): Mode {
  if (asked) return asked;
  if (!w) return "live";
  if (w.source) return "live";
  if (w.owner_bot_id || w.brief) return "ask";
  return "write";
}

export function WidgetBuilder({ widget, initial, onClose }: { widget: WidgetRow | null; initial?: Mode; onClose: () => void }) {
  const { data, nowMs, run } = useDashboard();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const editing = !!widget;
  const startKind = widget && isCustomKind(widget.kind) ? widget.kind : null;

  const [mode, setMode] = useState<Mode>(() => initialMode(widget, initial));
  const [title, setTitle] = useState(widget?.title ?? "");
  const [icon, setIcon] = useState(widget?.icon ?? "");
  const [size, setSize] = useState<WidgetSize>(() => (widget ? (widget.size as WidgetSize) : "m"));
  const [busy, setBusy] = useState(false);

  // Live
  const startSource = (widget?.source ?? null) as WidgetSource | null;
  const [sourceId, setSourceId] = useState<SourceId>(startSource?.id ?? "tasks_done");
  const [days, setDays] = useState(startSource?.days ?? DEFAULT_DAYS);
  const [habit, setHabit] = useState(startSource?.habit ?? "");
  const [liveKind, setLiveKind] = useState<CustomKind>(startSource && startKind ? startKind : SOURCE_INFO[startSource?.id ?? "tasks_done"].kinds[0]);
  const [livePayload, setLivePayload] = useState<Payload | null>(startSource ? (widget!.payload as Payload) : null);
  const [liveLoading, setLiveLoading] = useState(false);

  // Write
  const [writeKind, setWriteKind] = useState<CustomKind>(startKind && !startSource && widget?.published_at ? startKind : "list");
  const [payload, setPayload] = useState<Payload>(() => (startKind && !startSource && widget?.published_at ? clone(widget!.payload as Payload) : clone(KIND_INFO.list.example as Payload)));
  const [tab, setTab] = useState<"form" | "json">("form");
  const [editorKey, setEditorKey] = useState(0);
  const [accent, setAccent] = useState<Accent | undefined>((widget?.payload as Payload | undefined)?.accent as Accent | undefined);

  // Ask
  const [brief, setBrief] = useState(widget?.brief ?? "");
  const [owner, setOwner] = useState(widget?.owner_bot_id ?? data.bots.find((b) => b.is_coordinator)?.id ?? data.bots[0]?.id ?? "");
  const [askKind, setAskKind] = useState<CustomKind | typeof BOT_CHOICE>(startKind && (widget?.brief || widget?.owner_bot_id) ? startKind : BOT_CHOICE);
  const [stale, setStale] = useState<number | null>(widget?.stale_after_hours ?? 24);
  const [copied, setCopied] = useState(false);

  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  useEscape(onClose, true);
  useScrollLock(true);
  useFocusTrap(panel, true);

  const source: WidgetSource = useMemo(
    () => ({ id: sourceId, ...(SOURCE_INFO[sourceId].windowed ? { days } : {}), ...(sourceId === "habits_rate" && habit ? { habit } : {}) }),
    [sourceId, days, habit],
  );

  // Live preview: what the source looks like right now.
  const sourceKey = JSON.stringify([source, liveKind]);
  // A live widget opened for editing already carries today's payload.
  const openedKey = useRef(startSource ? sourceKey : null);
  useEffect(() => {
    if (mode !== "live") return;
    if (sourceKey === openedKey.current) return;
    openedKey.current = null;
    let live = true;
    const t = window.setTimeout(async () => {
      setLiveLoading(true);
      const p = await run(previewSourceAction(source, liveKind), { quiet: true });
      if (!live) return;
      setLiveLoading(false);
      if (p) setLivePayload(p);
    }, 120);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, mode]);

  const styled = (p: Payload): Payload => {
    const next: Payload = { ...p };
    if (accent) next.accent = accent;
    else delete next.accent;
    return next;
  };
  const writeValid = validatePayload(writeKind, styled(payload));
  const [lastGood, setLastGood] = useState<{ kind: CustomKind; payload: unknown }>({ kind: writeKind, payload: styled(payload) });
  if (writeValid.ok && (lastGood.kind !== writeKind || JSON.stringify(lastGood.payload) !== JSON.stringify(writeValid.data))) {
    setLastGood({ kind: writeKind, payload: writeValid.data });
  }

  const askOwner = data.bots.find((b) => b.id === owner) ?? null;
  const shownKind: CustomKind = mode === "live" ? liveKind : mode === "write" ? lastGood.kind : askKind === BOT_CHOICE ? "markdown" : askKind;
  const shownPayload = mode === "live" ? (livePayload ? styled(livePayload) : null) : mode === "write" ? lastGood.payload : null;
  const autoTitle = mode === "live" ? SOURCE_INFO[sourceId].label : mode === "write" ? KIND_INFO[writeKind].label : "New widget";
  const finalTitle = title.trim() || autoTitle;

  const pickSource = (id: SourceId) => {
    setSourceId(id);
    if (!SOURCE_INFO[id].kinds.includes(liveKind)) setLiveKind(SOURCE_INFO[id].kinds[0]);
    if (!SOURCE_INFO[id].kinds.includes(liveKind) && !editing) setSize(defaultSizeFor(SOURCE_INFO[id].kinds[0]));
  };
  const pickKind = (k: CustomKind) => {
    setWriteKind(k);
    setPayload(clone(KIND_INFO[k].example as Payload));
    setAccent((KIND_INFO[k].example as Payload).accent as Accent | undefined);
    setEditorKey((x) => x + 1);
    if (!hasForm(k)) setTab("json");
    if (!editing) setSize(defaultSizeFor(k));
  };

  const canSave = !busy && (mode === "live" ? !!livePayload : mode === "write" ? writeValid.ok : brief.trim().length > 2 && !!owner);

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    const base = { title: finalTitle, icon: icon.trim() || null };
    let ok: unknown = null;
    if (!editing) {
      ok =
        mode === "live"
          ? await run(createWidgetAction({ ...base, kind: liveKind, size, source }), { success: "Live widget added" })
          : mode === "write"
            ? await run(createWidgetAction({ ...base, kind: writeKind, size, payload: styled(payload) }), { success: "Widget added" })
            : await run(
                createWidgetAction({ ...base, kind: askKind === BOT_CHOICE ? "markdown" : askKind, size, brief: brief.trim(), owner_bot_id: owner, stale_after_hours: stale }),
                { success: askOwner ? `Sent to ${askOwner.name}` : "Widget added" },
              );
    } else {
      const id = widget!.id;
      if (mode === "live") {
        ok = await run(updateWidgetAction(id, { ...base, source, kind: liveKind }), { success: "Widget saved" });
      } else if (mode === "write") {
        const patch: WidgetPatch = { ...base };
        if (widget!.source) patch.source = null;
        ok = (await run(updateWidgetAction(id, patch), { quiet: false })) && (await run(publishWidgetAction(id, styled(payload), writeKind), { success: "Widget saved" }));
      } else {
        const patch: WidgetPatch = { ...base, brief: brief.trim(), owner_bot_id: owner || null, stale_after_hours: stale };
        if (widget!.source) patch.source = null;
        if (askKind !== BOT_CHOICE && askKind !== widget!.kind && (widget!.source || !widget!.published_at)) patch.kind = askKind;
        ok = await run(updateWidgetAction(id, patch), { success: "Widget saved" });
      }
    }
    setBusy(false);
    if (ok) onClose();
  };

  const nudge = `I added a widget "${finalTitle}" to my Hyperpolymath dashboard for you to fill: ${brief.trim()} Please check widget_requests in get_overview, call widget_kinds, pick the best kind and publish it.`;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center lg:items-center lg:p-6">
      <motion.div className="absolute inset-0 bg-[rgb(20_20_20/0.22)] backdrop-blur-[6px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        ref={setPanel}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit widget" : "New widget"}
        tabIndex={-1}
        initial={desktop ? { opacity: 0, scale: 0.96, y: 16 } : { y: "100%" }}
        animate={desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
        exit={desktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: "100%" }}
        transition={{ type: "spring", duration: 0.45, bounce: 0.08 }}
        className="relative flex h-[94dvh] w-full max-w-[1240px] flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-lift outline-none focus-visible:outline-none lg:h-[min(860px,92dvh)] lg:flex-row lg:rounded-[28px]"
      >
        {/* Form */}
        <div className="flex min-h-0 w-full flex-col lg:w-[480px] lg:shrink-0 lg:border-r lg:border-gray-150">
          <div className="flex items-center justify-between px-5 pb-2 pt-4 sm:px-6">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-accent">{editing ? "Edit widget" : "New widget"}</div>
              <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{editing ? widget!.title : "Make something worth a glance"}</h2>
            </div>
            <CloseButton onClick={onClose} className="lg:hidden" />
          </div>

          {/* Phone: the preview rides on top. */}
          {!desktop && (
            <div className="mx-5 mb-2 overflow-hidden rounded-[20px] bg-gray-100 sm:mx-6">
              <Preview kind={shownKind} payload={shownPayload} size={size} title={finalTitle} icon={icon} mode={mode} loading={liveLoading} owner={askOwner} brief={brief} compactStage tz={data.tz} nowMs={nowMs} />
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 sm:px-6">
            <LayoutGroup id="builder-modes">
              <div className="mt-2 grid grid-cols-3 gap-2">
                {MODES.map((m) => {
                  const active = m.id === mode;
                  return (
                    <button key={m.id} type="button" onClick={() => setMode(m.id)} aria-pressed={active} className={`relative rounded-[18px] p-3 text-left transition ${active ? "" : "hover:bg-gray-100"}`}>
                      {active && <motion.span layoutId="mode-bg" className="absolute inset-0 rounded-[18px] bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent)]" transition={{ type: "spring", duration: 0.4, bounce: 0.15 }} />}
                      <span className="relative block">
                        <span className={`mb-2 flex h-8 w-8 items-center justify-center rounded-[10px] transition ${active ? "bg-accent text-white" : "bg-gray-150 text-gray-700"}`}>{m.icon}</span>
                        <span className="block text-[13.5px] font-semibold leading-tight">{m.title}</span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-ink-3 max-sm:hidden">{m.text}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="mt-6 flex flex-col gap-6">
                {mode === "live" && (
                  <>
                    <Section title="What to show">
                      <SourcePicker value={sourceId} onChange={pickSource} />
                    </Section>
                    <Section title="Draw it as">
                      <KindChips kinds={SOURCE_INFO[sourceId].kinds} value={liveKind} onChange={setLiveKind} />
                    </Section>
                    {SOURCE_INFO[sourceId].windowed && (
                      <Section title="Looking back">
                        <Segmented
                          value={String(days)}
                          options={[7, 14, 30, 90, 365].map((d) => ({ value: String(d), label: d === 365 ? "1 year" : `${d} days` }))}
                          onChange={(v) => setDays(Number(v))}
                          size="sm"
                        />
                      </Section>
                    )}
                    {sourceId === "habits_rate" && data.habits.length > 0 && (
                      <Section title="Which habits">
                        <select value={habit} onChange={(e) => setHabit(e.target.value)} className={selectClass} style={selectStyle}>
                          <option value="">All habits</option>
                          {data.habits.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.icon ? `${h.icon} ` : ""}
                              {h.name}
                            </option>
                          ))}
                        </select>
                      </Section>
                    )}
                    <p className="rounded-[14px] bg-gray-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-3">
                      Live widgets never go stale: the app redraws them from your data every time the dashboard loads. Nothing is sent to a bot.
                    </p>
                  </>
                )}

                {mode === "write" && (
                  <>
                    <Section title="Pick a look">
                      <KindGallery value={writeKind} onChange={pickKind} tz={data.tz} nowMs={nowMs} />
                    </Section>
                    <Section
                      title="Content"
                      aside={
                        hasForm(writeKind) ? (
                          <Segmented
                            size="sm"
                            value={tab}
                            options={[
                              { value: "form", label: "Form" },
                              { value: "json", label: "JSON" },
                            ]}
                            onChange={(v) => {
                              setTab(v);
                              setEditorKey((x) => x + 1);
                            }}
                          />
                        ) : null
                      }
                    >
                      <div key={`${writeKind}-${tab}-${editorKey}`}>
                        {tab === "form" && hasForm(writeKind) ? (
                          <FormEditor kind={writeKind} payload={payload} onChange={setPayload} />
                        ) : (
                          <JsonEditor kind={writeKind} payload={payload} onChange={setPayload} />
                        )}
                      </div>
                      {!writeValid.ok && tab === "form" && <p className="mt-2 text-[12.5px] text-[#d61a2f]">{writeValid.error}</p>}
                    </Section>
                    <Section title="Color">
                      <AccentPicker value={accent} onChange={setAccent} />
                    </Section>
                  </>
                )}

                {mode === "ask" && (
                  <>
                    <Section title="Describe it" aside={<span className="text-[11.5px] text-ink-3">{brief.length}/2000</span>}>
                      <BriefInput value={brief} onChange={setBrief} />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[
                          "My unread email that needs a reply, every morning",
                          "Strava training this week as a chart",
                          "Top Hacker News stories about AI, twice a day",
                          "Assignments due this week from Canvas",
                        ].map((s) => (
                          <button key={s} type="button" onClick={() => setBrief(s)} className="rounded-full bg-gray-100 px-2.5 py-1 text-[12px] text-ink-2 transition hover:bg-gray-150 hover:text-ink">
                            {s}
                          </button>
                        ))}
                      </div>
                    </Section>
                    <Section title="Who fills it">
                      {data.bots.length ? (
                        <div className="flex flex-wrap gap-2">
                          {data.bots.map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => setOwner(b.id)}
                              className={`flex h-10 items-center gap-2 rounded-full pl-1.5 pr-3.5 text-[13.5px] font-medium transition ${owner === b.id ? "bg-ink text-white" : "bg-gray-150 text-ink-2 hover:bg-gray-200"}`}
                            >
                              <BotAvatar bot={b} size={26} />
                              {b.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[13px] leading-relaxed text-ink-3">No bots yet. Connect an assistant in Settings, then come back to hand it this widget.</p>
                      )}
                    </Section>
                    <Section title="Look">
                      <div className="flex flex-wrap gap-1.5">
                        <Chip active={askKind === BOT_CHOICE} onClick={() => setAskKind(BOT_CHOICE)}>
                          <IconSparkle size={14} /> Bot&apos;s choice
                        </Chip>
                        {CUSTOM_KINDS.map((k) => (
                          <Chip key={k} active={askKind === k} onClick={() => setAskKind(k)}>
                            {KIND_INFO[k].label}
                          </Chip>
                        ))}
                      </div>
                    </Section>
                    <Section title="Greys out when not updated for">
                      <Segmented
                        size="sm"
                        value={String(stale ?? 0)}
                        options={[
                          { value: "6", label: "6h" },
                          { value: "24", label: "1 day" },
                          { value: "168", label: "1 week" },
                          { value: "0", label: "Never" },
                        ]}
                        onChange={(v) => setStale(v === "0" ? null : Number(v))}
                      />
                    </Section>
                    {askOwner && brief.trim().length > 2 && (
                      <div className="rounded-[16px] bg-gray-50 p-3.5">
                        <p className="text-[12.5px] leading-relaxed text-ink-3">
                          {askOwner.name} sees this request the next time it checks in. To have it start now, paste this into your chat with {askOwner.name}:
                        </p>
                        <p className="mt-2 rounded-[12px] bg-white px-3 py-2 text-[12.5px] leading-relaxed text-ink-2 shadow-ring">{nudge}</p>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard?.writeText(nudge).then(() => {
                              setCopied(true);
                              window.setTimeout(() => setCopied(false), 1600);
                            });
                          }}
                          className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium text-accent transition hover:bg-accent-soft"
                        >
                          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />} {copied ? "Copied" : "Copy message"}
                        </button>
                      </div>
                    )}
                  </>
                )}

                <Section title="Name and icon">
                  <div className="flex gap-2">
                    <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="📈" maxLength={500} aria-label="Icon: an emoji or a website" className={`${fieldClass} w-14 shrink-0 text-center`} />
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={autoTitle} maxLength={60} aria-label="Title" className={`${fieldClass} min-w-0 flex-1`} />
                  </div>
                </Section>
                {!editing && (
                  <Section title="Size">
                    <SizePicker value={size} onChange={setSize} />
                  </Section>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-gray-150 bg-surface/90 px-5 py-3 backdrop-blur sm:px-6">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} disabled={!canSave}>
              {busy ? "Saving…" : editing ? "Save" : mode === "ask" ? `Send to ${askOwner?.name ?? "bot"}` : "Add to dashboard"}
            </Button>
          </div>
        </div>

        {/* Preview */}
        {desktop && (
          <div className="relative hidden min-w-0 flex-1 flex-col bg-gray-50 lg:flex">
            <div className="flex items-center justify-between px-6 pt-4">
              <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-gray-500">Preview</span>
              <div className="flex items-center gap-2">
                {editing && (
                  <Segmented
                    size="sm"
                    value={size}
                    options={(["s", "m", "l", "w"] as WidgetSize[]).map((s) => ({ value: s, label: s.toUpperCase() }))}
                    onChange={setSize}
                  />
                )}
                <CloseButton onClick={onClose} />
              </div>
            </div>
            <Preview kind={shownKind} payload={shownPayload} size={size} title={finalTitle} icon={icon} mode={mode} loading={liveLoading} owner={askOwner} brief={brief} tz={data.tz} nowMs={nowMs} />
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex min-h-7 items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-ink-2">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition active:scale-[0.97] ${active ? "bg-ink text-white" : "bg-gray-150 text-ink-2 hover:bg-gray-200"}`}
    >
      {children}
    </button>
  );
}

function KindChips({ kinds, value, onChange }: { kinds: CustomKind[]; value: CustomKind; onChange: (k: CustomKind) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {kinds.map((k) => (
        <Chip key={k} active={k === value} onClick={() => onChange(k)}>
          {KIND_INFO[k].label}
        </Chip>
      ))}
    </div>
  );
}

const GROUP_EMOJI: Record<string, string> = { Tasks: "✅", Habits: "🌱", Captures: "💡", Rhythm: "⏱️", Teammates: "🤖" };

function SourcePicker({ value, onChange }: { value: SourceId; onChange: (s: SourceId) => void }) {
  const groups = [...new Set(SOURCE_IDS.map((id) => SOURCE_INFO[id].group))];
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <div key={g}>
          <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-gray-500">
            {GROUP_EMOJI[g]} {g}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {SOURCE_IDS.filter((id) => SOURCE_INFO[id].group === g).map((id) => {
              const s = SOURCE_INFO[id];
              const active = id === value;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChange(id)}
                  aria-pressed={active}
                  className={`relative rounded-[14px] px-3 py-2.5 text-left transition ${active ? "bg-ink text-white" : "bg-gray-100 hover:bg-gray-150"}`}
                >
                  <span className="block text-[13px] font-semibold">{s.label}</span>
                  <span className={`mt-0.5 block text-[11.5px] leading-snug ${active ? "text-white/70" : "text-ink-3"}`}>{s.blurb}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Every kind, drawn small from its example, so choosing is seeing. */
function KindGallery({ value, onChange, tz, nowMs }: { value: CustomKind; onChange: (k: CustomKind) => void; tz: string; nowMs: number }) {
  return (
    <ChartEnv tz={tz} nowMs={nowMs}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CUSTOM_KINDS.map((k, i) => {
          const active = k === value;
          const size: WidgetSize = k === "stat" ? "s" : k === "blocks" || k === "table" ? "l" : "m";
          const px = cardPixels(size);
          const scale = Math.min(132 / px.width, 74 / px.height);
          return (
            <motion.button
              key={k}
              type="button"
              onClick={() => onChange(k)}
              aria-pressed={active}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.025 }}
              whileTap={{ scale: 0.97 }}
              className={`group overflow-hidden rounded-[16px] text-left transition ${active ? "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent)]" : "bg-gray-50 shadow-[inset_0_0_0_1px_rgb(20_20_20/0.05)] hover:bg-gray-100"}`}
            >
              <div className="pointer-events-none flex h-[86px] items-center justify-center overflow-hidden">
                <div className="transition duration-300 group-hover:scale-[1.04]">
                  <PreviewCard kind={k} payload={KIND_INFO[k].example} size={size} title={KIND_INFO[k].label} scale={scale} />
                </div>
              </div>
              <div className="px-2.5 pb-2">
                <div className="text-[12.5px] font-semibold">{KIND_INFO[k].label}</div>
                <div className="line-clamp-1 text-[11px] text-ink-3">{KIND_INFO[k].blurb}</div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </ChartEnv>
  );
}

function BriefInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const dictation = useDictation((t) => onChange(`${latest.current.trim() ? `${latest.current.trim()} ` : ""}${t}`.slice(0, 2000)));
  return (
    <div className={`relative rounded-[16px] bg-gray-100 ring-1 transition focus-within:bg-white focus-within:ring-accent/35 ${dictation.listening ? "bg-white ring-danger/40" : "ring-transparent"}`}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 2000))}
        placeholder="What should this widget show, where does it come from, and how often should it refresh?"
        className="min-h-[120px] w-full resize-none bg-transparent px-3.5 pb-12 pt-3 text-[14.5px] leading-relaxed outline-none placeholder:text-ink-3"
      />
      <AnimatePresence>
        {dictation.interim && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute bottom-12 left-3.5 right-3.5 truncate text-[13px] italic text-ink-3">
            {dictation.interim}
          </motion.p>
        )}
      </AnimatePresence>
      {dictation.supported && (
        <button
          type="button"
          onClick={dictation.listening ? dictation.stop : dictation.start}
          className={`absolute bottom-2.5 left-2.5 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition ${dictation.listening ? "bg-danger text-white" : "bg-white text-ink-2 shadow-ring hover:text-ink"}`}
        >
          <span className="relative flex">
            {dictation.listening && <span className="absolute inset-0 animate-ping rounded-full bg-white/60" />}
            <IconMic size={15} className="relative" />
          </span>
          {dictation.listening ? "Listening… tap to stop" : "Dictate"}
        </button>
      )}
    </div>
  );
}

/** The real card, at true scale when there's room, on a quiet stage. */
function Preview({
  kind,
  payload,
  size,
  title,
  icon,
  mode,
  loading,
  owner,
  brief,
  compactStage = false,
  tz,
  nowMs,
}: {
  kind: CustomKind;
  payload: unknown;
  size: WidgetSize;
  title: string;
  icon: string;
  mode: Mode;
  loading: boolean;
  owner: { id: string; name: string; avatar_shape: string; avatar_color: string } | null;
  brief: string;
  compactStage?: boolean;
  tz: string;
  nowMs: number;
}) {
  const [ref, box] = useSize<HTMLDivElement>();
  const px = cardPixels(size);
  const pad = compactStage ? 16 : 56;
  const scale = box.width ? Math.min(1, (box.width - pad * 2) / px.width, compactStage ? 210 / px.height : (box.height - pad * 2) / px.height) : 0;
  const waiting =
    mode === "ask" ? (
      <div className={`flex h-full items-center justify-center ${size === "m" ? "gap-3" : "flex-col text-center"}`}>
        {size === "s" ? owner && <BotAvatar bot={owner} size={28} className="opacity-60" /> : <KiwiWaiting size={size === "m" ? 76 : 132} className="shrink-0" />}
        <div className="min-w-0">
          <p className="text-[13px] leading-snug text-ink-3">Waiting for {owner?.name ?? "a bot"} to publish</p>
          {brief.trim() && size !== "s" && <p className="mt-1 line-clamp-2 text-[12px] italic leading-snug text-ink-3">“{brief.trim()}”</p>}
        </div>
      </div>
    ) : !payload ? (
      <div className="flex h-full flex-col gap-2 pt-2">
        <div className="skeleton h-6 w-1/3 rounded-full" />
        <div className="skeleton min-h-0 flex-1 rounded-[14px]" />
      </div>
    ) : undefined;
  const meta =
    mode === "live" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-[0.04em] text-success">
        <span className="pulse-live h-1.5 w-1.5 rounded-full bg-success" />
        Live
      </span>
    ) : mode === "write" ? (
      <span className="text-[11.5px] font-normal text-ink-3">just now</span>
    ) : null;

  return (
    <div
      ref={ref}
      className={`relative flex flex-1 items-center justify-center overflow-hidden ${compactStage ? "h-[242px]" : ""}`}
      style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgb(20 20 20 / 0.07) 1px, transparent 0)", backgroundSize: "18px 18px" }}
    >
      {scale > 0 && (
        <motion.div layout transition={{ type: "spring", duration: 0.5, bounce: 0.12 }} animate={{ opacity: loading ? 0.6 : 1 }}>
          <ChartEnv tz={tz} nowMs={nowMs}>
            <PreviewCard key={`${kind}-${size}-${mode}`} kind={kind} payload={payload} size={size} title={title} icon={icon.trim() || null} meta={meta} scale={scale} empty={waiting} />
          </ChartEnv>
        </motion.div>
      )}
      {!compactStage && (
        <p className="absolute bottom-4 left-0 right-0 text-center text-[12px] text-ink-3">
          {scale < 1 && scale > 0 ? `Shown at ${Math.round(scale * 100)}% · ` : ""}
          {mode === "live" ? "Drawn from your real data" : mode === "write" ? "Updates as you type" : "Your bot will fill this in"}
        </p>
      )}
    </div>
  );
}
