"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ProjectStatus } from "@/lib/dashboard-types";
import { STATUSES, STATUS_LABELS, asStatus, isLive, matchesProject, type ProjectEntry } from "@/lib/projects";
import { Button, Sheet, fieldClass, stop } from "@/components/ui/primitives";
import { IconCheck, IconChevronDown, IconFolder, IconSearch } from "@/components/ui/icons";
import { useProjects } from "./use-projects";

const noSubscribe = () => () => {};

/**
 * Renders a sheet into document.body, so a transformed ancestor (the
 * expanded view's morph) can't trap its fixed positioning. React events
 * still bubble through portals, so taps inside are stopped here and never
 * toggle the row, open the widget, or start a drag they were opened from.
 */
export function Layer({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(
    <div className="contents" onClick={stop} onPointerDown={stop} onMouseDown={stop} onTouchStart={stop}>
      {children}
    </div>,
    document.body,
  );
}

/* ---------- emoji ---------- */

/** An area or project's emoji, or a quiet folder glyph when it has none. */
export function Emoji({ emoji, size = 16, className = "" }: { emoji: string | null | undefined; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center leading-none ${emoji ? "" : "text-gray-400"} ${className}`}
      style={{ width: size + 2, height: size + 2, fontSize: size }}
    >
      {emoji || <IconFolder size={size - 1} />}
    </span>
  );
}

const EMOJIS = [
  "🎓", "📚", "✏️", "🧪", "🧠", "💼", "💻", "🛠️", "📈", "💰",
  "🏠", "🌱", "🏃", "🧘", "🍎", "❤️", "👨‍👩‍👧", "🤝", "✈️", "🗺️",
  "🎨", "🎵", "📷", "🎮", "⚽", "🚀", "⭐", "🔥", "🎯", "🧩",
  "📝", "📦", "🔬", "🏛️", "🌍", "☕", "🐾", "🎉", "🧳", "🗂️",
];

/** Tap the emoji to change it: a sheet with common picks and a field for any emoji. */
export function EmojiButton({
  value,
  onChange,
  size = 28,
  label = "Choose an emoji",
  className = "",
}: {
  value: string | null;
  onChange: (emoji: string | null) => void;
  size?: number;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const pick = (e: string | null) => {
    setOpen(false);
    setCustom("");
    if (e !== value) onChange(e);
  };
  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        onPointerDown={stop}
        className={`inline-flex shrink-0 items-center justify-center rounded-[12px] transition hover:bg-gray-150 active:scale-95 ${className}`}
        style={{ width: size + 12, height: size + 12 }}
      >
        <Emoji emoji={value} size={size} />
      </button>
      <Layer>
        <Sheet open={open} onClose={() => setOpen(false)} title="Emoji" width={400}>
          <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => pick(e)}
                aria-label={e}
                className={`flex aspect-square items-center justify-center rounded-[10px] text-[22px] transition hover:bg-gray-150 ${
                  e === value ? "bg-accent-soft" : ""
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <form
            className="mt-4 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = [...custom.trim()].slice(0, 4).join("");
              if (v) pick(v);
            }}
          >
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Or type any emoji"
              maxLength={16}
              aria-label="Custom emoji"
              className={`${fieldClass} flex-1`}
            />
            <Button size="sm" variant="dark" type="submit" disabled={!custom.trim()}>
              Use
            </Button>
          </form>
          {value && (
            <Button size="sm" variant="ghost" className="mt-3" onClick={() => pick(null)}>
              Remove emoji
            </Button>
          )}
        </Sheet>
      </Layer>
    </>
  );
}

/* ---------- chips and pills ---------- */

/** Small "emoji name" chip for a task's or capture's project. */
export function ProjectChip({
  projectId,
  compact = false,
  className = "",
}: {
  projectId: string | null;
  /** Emoji only below the sm breakpoint. */
  compact?: boolean;
  className?: string;
}) {
  const { index } = useProjects();
  const entry = projectId ? index.get(projectId) : undefined;
  if (!entry) return null;
  return (
    <span
      title={entry.area ? `${entry.area.name} / ${entry.project.name}` : entry.project.name}
      className={`inline-flex min-w-0 max-w-[160px] shrink items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[12px] font-medium text-gray-600 ${className}`}
    >
      <Emoji emoji={entry.project.emoji} size={11} />
      <span className={`truncate ${compact ? "max-sm:sr-only" : ""}`}>{entry.project.name}</span>
    </span>
  );
}

const STATUS_TONE: Record<ProjectStatus, string> = {
  active: "bg-accent-soft text-accent-hover",
  paused: "bg-gray-150 text-gray-600",
  done: "bg-[rgb(47_178_107/0.12)] text-[#1f7a49]",
};

/** Status pill that doubles as a native select, so phones get their own picker. */
export function StatusPill({
  status,
  onChange,
  size = "sm",
}: {
  status: string;
  onChange?: (s: ProjectStatus) => void;
  size?: "sm" | "md";
}) {
  const s = asStatus(status);
  const pill = `inline-flex items-center gap-1 rounded-full font-semibold ${STATUS_TONE[s]} ${
    size === "md" ? "h-7 px-3 text-[12.5px]" : "h-[22px] px-2 text-[11.5px]"
  }`;
  if (!onChange) return <span className={pill}>{STATUS_LABELS[s]}</span>;
  return (
    <span className={`relative ${pill}`} onClick={stop} onPointerDown={stop}>
      {STATUS_LABELS[s]}
      <IconChevronDown size={size === "md" ? 13 : 11} strokeWidth={2.2} className="opacity-70" />
      <select
        aria-label="Project status"
        value={s}
        onChange={(e) => onChange(e.target.value as ProjectStatus)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {STATUSES.map((v) => (
          <option key={v} value={v}>
            {STATUS_LABELS[v]}
          </option>
        ))}
      </select>
    </span>
  );
}

/** Thin done/total bar. */
export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-1 overflow-hidden rounded-full bg-gray-150 ${className}`}>
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-500"
        style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }}
      />
    </div>
  );
}

/* ---------- project picker ---------- */

/**
 * Searchable project picker grouped by area, with "No project" on top.
 * Lists active and paused projects, plus the current one whatever its state.
 */
export function ProjectPicker({
  open,
  onClose,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  value: string | null;
  onChange: (projectId: string | null) => void;
}) {
  const { areas, unsorted, index } = useProjects();
  const [query, setQuery] = useState("");
  const pick = (id: string | null) => {
    onClose();
    setQuery("");
    if (id !== value) onChange(id);
  };
  const keep = (e: ProjectEntry) => (isLive(e.project) || e.project.id === value) && matchesProject(e, query);
  const groups = [
    ...areas.map((a) => ({
      key: a.id,
      title: a.name,
      emoji: a.emoji,
      entries: a.projects.map((p) => index.get(p.id)!).filter(Boolean).filter(keep),
    })),
    { key: "none", title: "No area", emoji: null, entries: unsorted.map((p) => index.get(p.id)!).filter(Boolean).filter(keep) },
  ].filter((g) => g.entries.length);
  const current = value ? index.get(value) : undefined;
  // The current project can live in an archived area; still show it.
  if (current && !groups.some((g) => g.entries.includes(current)) && matchesProject(current, query)) {
    groups.push({ key: "current", title: "Current", emoji: null, entries: [current] });
  }
  const empty = !groups.length && !!query.trim();

  return (
    <Layer>
      <Sheet
        open={open}
        onClose={() => {
          onClose();
          setQuery("");
        }}
        title="Project"
        width={420}
      >
        <label className="flex h-10 items-center gap-2 rounded-full bg-gray-100 px-3.5 text-ink-3 focus-within:bg-white focus-within:shadow-ring">
          <IconSearch size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects"
            aria-label="Search projects"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
          />
        </label>
        <div className="mt-3 flex flex-col pb-1">
          {!query.trim() && (
            <PickerRow selected={value === null} onClick={() => pick(null)}>
              <span className="text-ink-2">No project</span>
            </PickerRow>
          )}
          {groups.map((g) => (
            <div key={g.key} className="mt-3">
              <div className="mb-0.5 flex items-center gap-1.5 px-2 text-[12px] font-semibold text-gray-500">
                {g.emoji && <span className="text-[12px]">{g.emoji}</span>}
                {g.title}
              </div>
              {g.entries.map((e) => (
                <PickerRow key={e.project.id} selected={e.project.id === value} onClick={() => pick(e.project.id)}>
                  <Emoji emoji={e.project.emoji} size={16} />
                  <span className={`truncate ${isLive(e.project) ? "" : "text-ink-3"}`}>{e.project.name}</span>
                  {e.project.status === "paused" && <span className="text-[12px] text-ink-3">Paused</span>}
                </PickerRow>
              ))}
            </div>
          ))}
          {empty && <div className="py-8 text-center text-[14px] text-ink-3">No projects match.</div>}
          {!query.trim() && !groups.length && (
            <p className="px-2 pt-4 text-[13px] leading-snug text-ink-3">
              No projects yet. Create one from the Projects widget, or ask Kiwi.
            </p>
          )}
        </div>
      </Sheet>
    </Layer>
  );
}

function PickerRow({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 w-full min-w-0 items-center gap-2 rounded-[12px] px-2 text-left text-[14.5px] transition ${
        selected ? "bg-accent-soft" : "hover:bg-gray-100"
      }`}
    >
      {children}
      {selected && <IconCheck size={16} strokeWidth={2.2} className="ml-auto shrink-0 text-accent" />}
    </button>
  );
}

/** A button showing the current project (or "No project") that opens the picker. */
export function ProjectField({
  value,
  onChange,
  className = "",
  placeholder = "No project",
}: {
  value: string | null;
  onChange: (projectId: string | null) => void;
  className?: string;
  placeholder?: string;
}) {
  const { index } = useProjects();
  const [open, setOpen] = useState(false);
  const entry = value ? index.get(value) : undefined;
  return (
    <>
      <button
        type="button"
        aria-label="Project"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        onPointerDown={stop}
        className={`inline-flex min-w-0 items-center gap-1.5 text-left ${className}`}
      >
        <Emoji emoji={entry?.project.emoji} size={14} />
        <span className={`truncate ${entry ? "" : "text-ink-3"}`}>{entry ? entry.project.name : placeholder}</span>
      </button>
      <ProjectPicker open={open} onClose={() => setOpen(false)} value={value} onChange={onChange} />
    </>
  );
}
