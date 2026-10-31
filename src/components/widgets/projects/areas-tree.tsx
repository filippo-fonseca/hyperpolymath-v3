"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ProjectWithCounts } from "@/lib/dashboard-types";
import { STATUS_LABELS, areaColor, asStatus, treeBranches, type TreeBranch } from "@/lib/projects";
import { pluralize } from "@/lib/format";
import { Button, Switch } from "@/components/ui/primitives";
import { IconChevronDown, IconFolder, IconPlus } from "@/components/ui/icons";
import { RootAvatar } from "@/components/ui/root-avatar";
import { useProjects } from "./use-projects";

/* ---------- saved view prefs ---------- */

// Collapsed areas and the archived toggle are a per-device convenience, so
// they live in localStorage. Storage can be missing or throw (private mode,
// blocked site data); the tree then keeps them in memory for the session.

type Prefs = { archived: boolean; collapsed: string[] };

const PREFS_KEY = "hp:areas-tree";
const DEFAULT_PREFS: Prefs = { archived: false, collapsed: [] };
const listeners = new Set<() => void>();
let cached: string | null | undefined;

function readPrefs(): string | null {
  if (cached === undefined) {
    try {
      cached = window.localStorage.getItem(PREFS_KEY);
    } catch {
      cached = null;
    }
  }
  return cached;
}

function writePrefs(next: Prefs) {
  cached = JSON.stringify(next);
  try {
    window.localStorage.setItem(PREFS_KEY, cached);
  } catch {
    // Kept in memory only.
  }
  listeners.forEach((l) => l());
}

function subscribePrefs(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== PREFS_KEY) return;
    cached = e.newValue;
    onChange();
  };
  listeners.add(onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function parsePrefs(raw: string | null): Prefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const v = JSON.parse(raw) as Partial<Prefs>;
    return {
      archived: v.archived === true,
      collapsed: Array.isArray(v.collapsed) ? v.collapsed.filter((k): k is string => typeof k === "string") : [],
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function useTreePrefs() {
  const raw = useSyncExternalStore(subscribePrefs, readPrefs, () => null);
  const prefs = useMemo(() => parsePrefs(raw), [raw]);
  const update = useCallback((fn: (p: Prefs) => Prefs) => writePrefs(fn(parsePrefs(readPrefs()))), []);
  return [prefs, update] as const;
}

/* ---------- connector geometry (wide screens) ---------- */

// Each area's <li> has 48px of top padding on wide screens: 28px of trunk
// from the root (or the row above) to the rail, then a 20px stub to the card.
const STUB = 20; // rail to the top of each card
const ELBOW = 12; // corner radius where a branch turns down into its card

/** Position of el inside container, ignoring transforms (the view's open morph scales everything). */
function offsetWithin(el: HTMLElement, container: HTMLElement) {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== container) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

/** From the trunk at (x0, y) across to x1, rounding the turn down to yEnd. */
function elbow(x0: number, x1: number, y: number, yEnd: number) {
  const run = x1 - x0;
  const r = Math.min(ELBOW, Math.abs(run), Math.max(yEnd - y, 0));
  if (Math.abs(run) < 1) return `M${x0} ${y}V${yEnd}`;
  if (r < 1) return `M${x0} ${y}H${x1}V${yEnd}`;
  const dir = run > 0 ? 1 : -1;
  return `M${x0} ${y}H${x1 - dir * r}Q${x1} ${y} ${x1} ${y + r}V${yEnd}`;
}

type Geometry = { w: number; h: number; d: string };

function measureTree(container: HTMLElement, root: HTMLElement, cards: HTMLElement[]): Geometry | null {
  if (!window.matchMedia("(min-width: 640px)").matches || !cards.length) return null;
  const r = offsetWithin(root, container);
  const x0 = Math.round(r.x + root.offsetWidth / 2);
  const top0 = r.y + root.offsetHeight;
  const points = cards
    .map((el) => {
      const o = offsetWithin(el, container);
      return { cx: Math.round(o.x + el.offsetWidth / 2), top: o.y };
    })
    .sort((a, b) => a.top - b.top);

  // Cards whose tops are within a few pixels share a row and a rail.
  const rows: (typeof points)[] = [];
  for (const p of points) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(p.top - row[0].top) < 8) row.push(p);
    else rows.push([p]);
  }

  const parts: string[] = [];
  let lastRail = top0;
  for (const row of rows) {
    const rail = row[0].top - STUB;
    for (const p of row) parts.push(elbow(x0, p.cx, rail, p.top));
    lastRail = rail;
  }
  // One trunk from the root down to the last rail; later rows pass behind the cards above.
  parts.unshift(`M${x0} ${top0}V${lastRail}`);
  return { w: container.offsetWidth, h: container.offsetHeight, d: parts.join("") };
}

/* ---------- tree ---------- */

/**
 * Areas as a tree: you at the root, a trunk into one card per area, and each
 * area's projects as chips. Wide screens draw the branches in SVG; phones get
 * a vertical outline drawn with plain lines.
 */
export function AreasTree({
  selectedId,
  onOpenProject,
  onFocusArea,
  onNewArea,
}: {
  /** The project whose sheet is open, if any. */
  selectedId: string | null;
  onOpenProject: (id: string) => void;
  /** Show one area (or "none") in the list. */
  onFocusArea: (key: string) => void;
  onNewArea: () => void;
}) {
  const { all } = useProjects();
  const [prefs, setPrefs] = useTreePrefs();
  const branches = useMemo(() => treeBranches(all, prefs.archived), [all, prefs.archived]);
  const collapsed = useMemo(() => new Set(prefs.collapsed), [prefs.collapsed]);
  const hasArchived = all.areas.some((a) => a.archived_at || a.projects.some((p) => p.archived_at)) || all.unsorted.some((p) => p.archived_at);

  const container = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const [geo, setGeo] = useState<Geometry | null>(null);
  const keys = branches.map((b) => b.key).join(",");

  useEffect(() => {
    const c = container.current;
    const r = root.current;
    if (!c || !r) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setGeo(measureTree(c, r, [...cards.current.values()])));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(c);
    ro.observe(r);
    cards.current.forEach((el) => ro.observe(el));
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [keys]);

  const toggle = (key: string) =>
    setPrefs((p) => ({
      ...p,
      collapsed: p.collapsed.includes(key) ? p.collapsed.filter((k) => k !== key) : [...p.collapsed, key],
    }));

  const projectCount = branches.reduce((n, b) => n + b.projects.length, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12.5px] text-gray-500">
          {pluralize(branches.filter((b) => b.area).length, "area")} · {pluralize(projectCount, "project")}
        </div>
        {hasArchived && (
          <label className="flex items-center gap-2.5 text-[13.5px] text-ink-2">
            Show archived
            <Switch checked={prefs.archived} onChange={(archived) => setPrefs((p) => ({ ...p, archived }))} label="Show archived" />
          </label>
        )}
      </div>

      <div ref={container} className="relative pb-4">
        {geo && (
          <svg
            aria-hidden
            width={geo.w}
            height={geo.h}
            className="pointer-events-none absolute left-0 top-0 hidden sm:block"
            fill="none"
          >
            <path d={geo.d} stroke="var(--gray-200)" strokeWidth={2} strokeLinecap="round" />
          </svg>
        )}

        <div className="relative flex sm:justify-center">
          <div ref={root} className="flex items-center gap-3 sm:flex-col sm:gap-1.5">
            <div className="rounded-full bg-surface p-1 shadow-ring">
              <RootAvatar size={56} />
            </div>
            <div className="text-[13.5px] font-semibold">You</div>
          </div>
        </div>

        {branches.length === 0 ? (
          <div className="relative mx-auto mt-10 max-w-[340px] text-center sm:mt-12">
            <p className="text-[14px] leading-relaxed text-ink-3">
              Areas are the big buckets of your life, like School, Work or Health. Add one and it grows here.
            </p>
            <Button size="sm" variant="dark" className="mt-4" onClick={onNewArea}>
              <IconPlus size={15} /> New area
            </Button>
          </div>
        ) : (
          <ul
            aria-label="Areas"
            className="relative flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-center sm:gap-x-8"
          >
            {branches.map((b, i) => (
              <AreaBranch
                key={b.key}
                branch={b}
                last={i === branches.length - 1}
                collapsed={collapsed.has(b.key)}
                onToggle={() => toggle(b.key)}
                selectedId={selectedId}
                onOpenProject={onOpenProject}
                onFocusArea={onFocusArea}
                cardRef={(el) => {
                  if (el) cards.current.set(b.key, el);
                  else cards.current.delete(b.key);
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AreaBranch({
  branch,
  last,
  collapsed,
  onToggle,
  selectedId,
  onOpenProject,
  onFocusArea,
  cardRef,
}: {
  branch: TreeBranch;
  last: boolean;
  collapsed: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onOpenProject: (id: string) => void;
  onFocusArea: (key: string) => void;
  cardRef: (el: HTMLElement | null) => void;
}) {
  const { area, projects } = branch;
  const name = area ? area.name : "No area";
  const archived = !!area?.archived_at;
  const color = area ? areaColor(area) : null;
  const listId = `areas-tree-${branch.key}`;

  return (
    <li className="relative pl-[52px] pt-4 sm:p-0 sm:pt-12">
      {/* Phone outline: the trunk runs down the left, with an elbow into each card. */}
      {!last && <span aria-hidden className="absolute bottom-0 left-[31px] top-0 w-[2px] bg-gray-200 sm:hidden" />}
      <span
        aria-hidden
        className="absolute left-[31px] top-0 h-[43px] w-[21px] rounded-bl-[12px] border-b-2 border-l-2 border-gray-200 sm:hidden"
      />

      <div
        ref={cardRef}
        className={`w-full rounded-[18px] p-3 sm:w-[220px] ${
          archived ? "border border-dashed border-gray-250 bg-surface/70" : "bg-surface shadow-widget"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-[15px] font-semibold leading-none"
            style={
              color
                ? { background: `color-mix(in srgb, ${color} 14%, transparent)`, color }
                : { background: "var(--gray-150)", color: "var(--gray-500)" }
            }
          >
            {area ? area.emoji || [...area.name.trim()][0]?.toUpperCase() || "·" : <IconFolder size={15} />}
          </span>
          {archived ? (
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink-2">{name}</span>
          ) : (
            <button
              type="button"
              onClick={() => onFocusArea(branch.key)}
              title={`Show ${name} in the list`}
              className="-mx-1 min-w-0 flex-1 truncate rounded-[8px] px-1 py-0.5 text-left text-[14px] font-semibold transition hover:bg-gray-100"
            >
              {name}
            </button>
          )}
          {archived && <span className="shrink-0 text-[11.5px] text-ink-3">Archived</span>}
          <span className="shrink-0 text-[12px] tabular-nums text-ink-3">{projects.length}</span>
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={listId}
            aria-label={collapsed ? `Show projects in ${name}` : `Hide projects in ${name}`}
            onClick={onToggle}
            className="-mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-150 active:scale-95"
          >
            <IconChevronDown
              size={15}
              className={`transition-transform duration-200 ease-out motion-reduce:transition-none ${collapsed ? "-rotate-90" : ""}`}
            />
          </button>
        </div>

        {collapsed ? (
          <div className="mt-2 pl-9 text-[12.5px] text-gray-500">{pluralize(projects.length, "project")}</div>
        ) : projects.length ? (
          <ul id={listId} aria-label={`Projects in ${name}`} className="mt-3 flex flex-wrap gap-1.5">
            {projects.map((p) => (
              <li key={p.id} className="min-w-0 max-w-full">
                <ProjectLeaf project={p} selected={p.id === selectedId} onOpen={() => onOpenProject(p.id)} />
              </li>
            ))}
          </ul>
        ) : (
          <div id={listId} className="mt-2 pl-9 text-[12.5px] text-gray-500">
            No projects yet
          </div>
        )}
      </div>
    </li>
  );
}

const DOT: Record<string, string> = { active: "bg-accent", paused: "bg-gray-400", done: "bg-success" };

function ProjectLeaf({ project: p, selected, onOpen }: { project: ProjectWithCounts; selected: boolean; onOpen: () => void }) {
  const status = asStatus(p.status);
  const done = status === "done";
  const label = `${p.name}, ${p.archived_at ? "archived" : STATUS_LABELS[status].toLowerCase()}`;
  const tone = selected
    ? "bg-accent-soft text-accent"
    : p.archived_at
      ? "border border-dashed border-gray-250 bg-transparent text-ink-2 hover:bg-gray-100"
      : "bg-gray-100 hover:bg-gray-150";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      className={`flex h-7 min-w-0 max-w-full items-center gap-1.5 rounded-chip px-2.5 text-[13px] transition active:scale-[0.98] motion-reduce:transition-none ${tone}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[status]}`} />
      <span className={`min-w-0 truncate ${done && !selected ? "text-ink-3 line-through" : ""}`}>{p.name}</span>
    </button>
  );
}
