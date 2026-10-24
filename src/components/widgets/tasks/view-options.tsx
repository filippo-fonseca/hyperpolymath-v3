"use client";

import { useState, type ReactNode } from "react";
import {
  DUE_FILTERS,
  DUE_LABELS,
  GROUPS_FOR,
  GROUP_LABELS,
  HAS_DUE_FILTER,
  NATURAL_DIR,
  NO_PROJECT,
  SORTS,
  SORT_LABELS,
  activeFilters,
  dirLabel,
  isDefaultView,
  type SortDir,
  type TaskViewKey,
} from "@/lib/task-view";
import { PRIORITY_LEVELS } from "@/lib/today";
import { Button, Sheet, fieldClass } from "@/components/ui/primitives";
import { IconArrowDown, IconArrowUp, IconFlag, IconSliders } from "@/components/ui/icons";
import { useProjects } from "../projects/use-projects";
import { priorityColors } from "./task-bits";
import type { useTaskView } from "./use-task-view";

type View = ReturnType<typeof useTaskView>;

const TITLES: Record<TaskViewKey, string> = { today: "Today", upcoming: "Upcoming", all: "All tasks" };

/** The "View" button: opens sort, grouping and filters for one tab. */
export function ViewOptionsButton({ view, options }: { view: TaskViewKey; options: View }) {
  const [open, setOpen] = useState(false);
  const filters = activeFilters(options.prefs);
  const changed = !isDefaultView(view, options.prefs);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={filters ? `View options, ${filters} filter${filters > 1 ? "s" : ""} on` : "View options"}
        className={`relative flex h-[38px] items-center gap-1.5 rounded-full px-3 text-[13.5px] font-medium transition ${
          filters ? "bg-accent-soft text-accent-hover" : "bg-gray-150 text-ink-2 hover:text-ink"
        }`}
      >
        <IconSliders size={16} />
        <span className="max-sm:sr-only">View</span>
        {filters > 0 && <span className="tabular-nums">{filters}</span>}
        {changed && !filters && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`View · ${TITLES[view]}`}>
        <ViewOptionsForm view={view} options={options} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function ViewOptionsForm({ view, options, onDone }: { view: TaskViewKey; options: View; onDone: () => void }) {
  const { prefs: p, set, reset } = options;
  const { areas, unsorted } = useProjects();
  const groups = GROUPS_FOR[view];
  const dirs: SortDir[] = NATURAL_DIR[p.sort] === "asc" ? ["asc", "desc"] : ["desc", "asc"];
  const togglePriority = (v: number) =>
    set({ priorities: p.priorities.includes(v) ? p.priorities.filter((x) => x !== v) : [...p.priorities, v].sort((a, b) => b - a) });

  return (
    <div className="flex flex-col gap-5 pb-1">
      <Field label="Sort by">
        <Pills>
          {SORTS.map((s) => (
            <Pill key={s} active={p.sort === s} onClick={() => p.sort !== s && set({ sort: s, dir: NATURAL_DIR[s] })}>
              {SORT_LABELS[s]}
            </Pill>
          ))}
        </Pills>
      </Field>

      <Field label="Order">
        <Pills>
          {dirs.map((d) => (
            <Pill key={d} active={p.dir === d} onClick={() => set({ dir: d })}>
              {d === "asc" ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />}
              {d === "asc" ? "Ascending" : "Descending"}
              <span className={`font-normal ${p.dir === d ? "opacity-80" : "text-ink-3"}`}>{dirLabel(p.sort, d)}</span>
            </Pill>
          ))}
        </Pills>
      </Field>

      {groups.length > 1 && (
        <Field label="Group by">
          <Pills>
            {groups.map((g) => (
              <Pill key={g} active={p.group === g} onClick={() => set({ group: g })}>
                {GROUP_LABELS[g]}
              </Pill>
            ))}
          </Pills>
        </Field>
      )}

      <div className="h-px bg-gray-150" />

      <Field label="Priority" hint={p.priorities.length ? undefined : "All"}>
        <Pills>
          {PRIORITY_LEVELS.map((l) => {
            const on = p.priorities.includes(l.value);
            const color = priorityColors(l.value).ring;
            return (
              <Pill key={l.value} active={on} onClick={() => togglePriority(l.value)} aria-label={l.name}>
                <IconFlag size={14} style={{ color: on ? undefined : color }} fill={l.value ? (on ? "currentColor" : color) : "none"} />
                {l.label}
              </Pill>
            );
          })}
        </Pills>
      </Field>

      <Field label="Project">
        <select
          aria-label="Project filter"
          value={p.project ?? ""}
          onChange={(e) => set({ project: e.target.value || null })}
          className={`${fieldClass} w-full appearance-none`}
        >
          <option value="">Any project</option>
          <option value={NO_PROJECT}>No project</option>
          {areas.map((a) =>
            a.projects.length ? (
              <optgroup key={a.id} label={a.name}>
                {a.projects.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name}
                  </option>
                ))}
              </optgroup>
            ) : null,
          )}
          {unsorted.length > 0 && (
            <optgroup label="No area">
              {unsorted.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </Field>

      {HAS_DUE_FILTER[view] && (
        <Field label="Due">
          <Pills>
            {DUE_FILTERS.map((d) => (
              <Pill key={d} active={p.due === d} onClick={() => set({ due: d })}>
                {DUE_LABELS[d]}
              </Pill>
            ))}
          </Pills>
        </Field>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button variant="ghost" size="sm" disabled={isDefaultView(view, p)} onClick={reset} className="h-10">
          Reset to defaults
        </Button>
        <Button variant="dark" size="sm" onClick={onDone} className="ml-auto h-10 px-5">
          Done
        </Button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2 text-[12.5px] font-semibold text-gray-500">
        {label}
        {hint && <span className="font-medium text-ink-3">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Pills({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function Pill({
  active,
  onClick,
  children,
  ...rest
}: { active: boolean; onClick: () => void; children: ReactNode } & React.AriaAttributes) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      {...rest}
      className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-medium transition ${
        active ? "bg-ink text-white" : "bg-gray-150 text-ink-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** Shown when filters hide every task in a list. */
export function FilteredOut({ hidden, onClear }: { hidden: number; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <div className="text-[15px] font-medium">No tasks match these filters</div>
      <div className="text-[13px] text-ink-3">
        {hidden} {hidden === 1 ? "task is" : "tasks are"} hidden.
      </div>
      <Button size="sm" onClick={onClear} className="mt-1 h-9">
        Clear filters
      </Button>
    </div>
  );
}
