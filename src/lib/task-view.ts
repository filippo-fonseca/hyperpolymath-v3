// View options for the task lists: how each tab sorts, groups and filters,
// with sensible defaults and a forgiving parser for what's saved in settings.

import { z } from "zod";
import type { AreasData, Task } from "./dashboard-types";
import { addDays } from "./time";
import { groupTasks } from "./projects";
import { PRIORITY_LEVELS } from "./today";

export const TASK_VIEWS = ["today", "upcoming", "all"] as const;
export type TaskViewKey = (typeof TASK_VIEWS)[number];

export const SORTS = ["priority", "due", "title", "created"] as const;
export type SortField = (typeof SORTS)[number];
export type SortDir = "asc" | "desc";

export const GROUPS = ["none", "priority", "date", "project", "area"] as const;
export type GroupField = (typeof GROUPS)[number];

export const DUE_FILTERS = ["any", "overdue", "today", "week", "dated", "none"] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

export const LAYOUTS = ["list", "board", "table"] as const;
export type Layout = (typeof LAYOUTS)[number];

/** "none" means tasks without a project; null means any project. */
export const NO_PROJECT = "none";

export type TaskViewPrefs = {
  sort: SortField;
  dir: SortDir;
  group: GroupField;
  /** Stored priorities to show (3 is P1). Empty shows every priority. */
  priorities: number[];
  project: string | null;
  due: DueFilter;
  layout: Layout;
};

export type TaskViews = Record<TaskViewKey, TaskViewPrefs>;

/** Groupings each tab offers. Upcoming is already split by day. */
export const GROUPS_FOR: Record<TaskViewKey, readonly GroupField[]> = {
  today: ["none", "priority", "project"],
  upcoming: ["none"],
  all: ["priority", "date", "project", "area", "none"],
};

/** Whether a tab offers the due-date filter (Today and Upcoming are dates already). */
export const HAS_DUE_FILTER: Record<TaskViewKey, boolean> = { today: false, upcoming: false, all: true };

/** The direction that reads naturally for each field: P1, soonest, A, newest first. */
export const NATURAL_DIR: Record<SortField, SortDir> = { priority: "desc", due: "asc", title: "asc", created: "desc" };

const base: TaskViewPrefs = { sort: "priority", dir: "desc", group: "none", priorities: [], project: null, due: "any", layout: "list" };

export const DEFAULT_VIEWS: TaskViews = {
  today: base,
  upcoming: base,
  // Everything at once reads best in priority bands, soonest due first in each.
  all: { ...base, sort: "due", dir: "asc", group: "priority" },
};

const fields = {
  sort: z.enum(SORTS),
  dir: z.enum(["asc", "desc"]),
  group: z.enum(GROUPS),
  priorities: z.array(z.number().int().min(0).max(3)).max(4),
  project: z.string().min(1).max(64).nullable(),
  due: z.enum(DUE_FILTERS),
  layout: z.enum(LAYOUTS),
};

/** What a client may send to save one tab's options. */
export const taskViewSchema = z.object({ view: z.enum(TASK_VIEWS), prefs: z.object(fields) });

/**
 * Saved options over the defaults, field by field, so an old or damaged
 * value only loses the field that's wrong.
 */
export function parseTaskViews(raw: unknown): TaskViews {
  const saved = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = {} as TaskViews;
  for (const view of TASK_VIEWS) {
    const v = (saved[view] && typeof saved[view] === "object" ? saved[view] : {}) as Record<string, unknown>;
    const prefs = { ...DEFAULT_VIEWS[view] } as Record<string, unknown>;
    for (const [k, schema] of Object.entries(fields)) {
      const r = schema.safeParse(v[k]);
      if (r.success && v[k] !== undefined) prefs[k] = r.data;
    }
    const p = prefs as TaskViewPrefs;
    if (!GROUPS_FOR[view].includes(p.group)) p.group = DEFAULT_VIEWS[view].group;
    if (!HAS_DUE_FILTER[view]) p.due = "any";
    p.priorities = [...new Set(p.priorities)].sort((a, b) => b - a);
    out[view] = p;
  }
  return out;
}

/* ---------------- sorting ---------------- */

const dueKey = (t: Task) => `${t.due_date}T${t.due_time?.slice(0, 5) ?? "99:99"}`;

function compareDue(a: Task, b: Task, sign: number) {
  // Undated tasks stay at the end either way.
  if (!a.due_date || !b.due_date) return a.due_date ? -1 : b.due_date ? 1 : 0;
  return sign * dueKey(a).localeCompare(dueKey(b));
}

const titles = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

function primary(sort: SortField, a: Task, b: Task, sign: number) {
  if (sort === "priority") return sign * (a.priority - b.priority);
  if (sort === "due") return compareDue(a, b, sign);
  if (sort === "title") return sign * titles.compare(a.title, b.title);
  return sign * a.created_at.localeCompare(b.created_at);
}

/** Ties fall back to priority, then the soonest due, then the saved position. */
function tiebreak(a: Task, b: Task) {
  return b.priority - a.priority || compareDue(a, b, 1) || a.position - b.position || a.created_at.localeCompare(b.created_at);
}

export function sortTasks(tasks: Task[], sort: SortField, dir: SortDir): Task[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...tasks].sort((a, b) => primary(sort, a, b, sign) || tiebreak(a, b));
}

/* ---------------- filtering ---------------- */

function dueMatches(t: Task, due: DueFilter, today: string) {
  const d = t.due_date;
  switch (due) {
    case "any":
      return true;
    case "overdue":
      return !!d && d < today;
    case "today":
      return d === today;
    case "week":
      return !!d && d >= today && d <= addDays(today, 6);
    case "dated":
      return !!d;
    case "none":
      return !d;
  }
}

export function filterTasks(tasks: Task[], p: TaskViewPrefs, today: string): Task[] {
  return tasks.filter(
    (t) =>
      (!p.priorities.length || p.priorities.includes(t.priority)) &&
      (p.project === null || (p.project === NO_PROJECT ? !t.project_id : t.project_id === p.project)) &&
      dueMatches(t, p.due, today),
  );
}

/** How many filters narrow the list, for the View button's badge. */
export function activeFilters(p: TaskViewPrefs): number {
  return (p.priorities.length ? 1 : 0) + (p.project !== null ? 1 : 0) + (p.due !== "any" ? 1 : 0);
}

export function isDefaultView(view: TaskViewKey, p: TaskViewPrefs): boolean {
  const d = DEFAULT_VIEWS[view];
  return (
    p.sort === d.sort &&
    p.dir === d.dir &&
    p.group === d.group &&
    p.due === d.due &&
    p.project === d.project &&
    p.priorities.length === d.priorities.length
  );
}

/* ---------------- grouping ---------------- */

export type TaskSection = { key: string; title: string; emoji?: string | null; tone?: "danger"; tasks: Task[] };

/**
 * Split sorted tasks into headed sections, keeping the sort inside each one.
 * Empty sections are left out; "none" is a single untitled section.
 */
export function groupSections(tasks: Task[], group: GroupField, today: string, areas: AreasData): TaskSection[] {
  let sections: TaskSection[];
  if (group === "priority") {
    sections = PRIORITY_LEVELS.map((l) => ({
      key: `p${l.value}`,
      title: l.value ? l.name : "No priority",
      tasks: tasks.filter((t) => t.priority === l.value),
    }));
  } else if (group === "date") {
    sections = [
      { key: "overdue", title: "Overdue", tone: "danger", tasks: tasks.filter((t) => t.due_date && t.due_date < today) },
      { key: "today", title: "Today", tasks: tasks.filter((t) => t.due_date === today) },
      { key: "upcoming", title: "Upcoming", tasks: tasks.filter((t) => t.due_date && t.due_date > today) },
      { key: "nodate", title: "No date", tasks: tasks.filter((t) => !t.due_date) },
    ];
  } else if (group === "project" || group === "area") {
    sections = groupTasks(tasks, areas, group);
  } else {
    sections = [{ key: "all", title: "", tasks }];
  }
  return sections.filter((s) => s.tasks.length);
}

/* ---------------- labels ---------------- */

export const SORT_LABELS: Record<SortField, string> = {
  priority: "Priority",
  due: "Due date",
  title: "Name",
  created: "Date added",
};

export const GROUP_LABELS: Record<GroupField, string> = {
  none: "None",
  priority: "Priority",
  date: "Due date",
  project: "Project",
  area: "Area",
};

export const DUE_LABELS: Record<DueFilter, string> = {
  any: "Any time",
  overdue: "Overdue",
  today: "Today",
  week: "Next 7 days",
  dated: "Has a date",
  none: "No date",
};

/** What ascending and descending mean for a field, in words. */
export function dirLabel(sort: SortField, dir: SortDir): string {
  const words: Record<SortField, [string, string]> = {
    priority: ["P4 to P1", "P1 to P4"],
    due: ["Soonest first", "Latest first"],
    title: ["A to Z", "Z to A"],
    created: ["Oldest first", "Newest first"],
  };
  return words[sort][dir === "asc" ? 0 : 1];
}
