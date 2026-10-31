// Client-safe helpers for life areas and projects: lookups, progress, labels
// and grouping. Pure functions so the widget, views and pickers agree.

import type { AreaWithProjects, AreasData, ProjectStatus, ProjectWithCounts, Task } from "./dashboard-types";

export type AreaRef = Pick<AreaWithProjects, "id" | "name" | "emoji">;
export type ProjectEntry = { project: ProjectWithCounts; area: AreaRef | null };

export const STATUS_LABELS: Record<ProjectStatus, string> = { active: "Active", paused: "Paused", done: "Done" };
export const STATUSES: ProjectStatus[] = ["active", "paused", "done"];

export function asStatus(s: string): ProjectStatus {
  return s === "paused" || s === "done" ? s : "active";
}

/** Every project by id, with its area (null when unsorted or the area is gone). */
export function indexProjects(data: AreasData): Map<string, ProjectEntry> {
  const map = new Map<string, ProjectEntry>();
  for (const a of data.areas) for (const p of a.projects) map.set(p.id, { project: p, area: a });
  for (const p of data.unsorted) map.set(p.id, { project: p, area: null });
  return map;
}

/** Not archived and not finished: what pickers and the widget lead with. */
export function isLive(p: Pick<ProjectWithCounts, "archived_at" | "status">) {
  return !p.archived_at && p.status !== "done";
}

/** Done share of a project's tasks, 0..1 (0 when it has none). */
export function progressOf(p: Pick<ProjectWithCounts, "open_tasks" | "done_tasks">) {
  const total = p.open_tasks + p.done_tasks;
  return total ? p.done_tasks / total : 0;
}

/** "CS 223 · Fall 2026" for a class, null otherwise. */
export function classLabel(p: Pick<ProjectWithCounts, "is_class" | "course_code" | "term">) {
  if (!p.is_class) return null;
  return [p.course_code, p.term].filter(Boolean).join(" · ") || "Class";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 2" from YYYY-MM-DD. */
export function monthDay(date: string) {
  const [, m, d] = date.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/** "Sep 2 to Dec 12", "From Sep 2", "Until Dec 12", or null. */
export function dateRangeLabel(p: Pick<ProjectWithCounts, "start_date" | "end_date">) {
  if (p.start_date && p.end_date) return `${monthDay(p.start_date)} to ${monthDay(p.end_date)}`;
  if (p.start_date) return `From ${monthDay(p.start_date)}`;
  if (p.end_date) return `Until ${monthDay(p.end_date)}`;
  return null;
}

/** Live areas in display order, each with only its non-archived projects. */
export function liveAreas(data: AreasData): AreaWithProjects[] {
  return data.areas.filter((a) => !a.archived_at).map((a) => ({ ...a, projects: a.projects.filter((p) => !p.archived_at) }));
}

export type TaskGroup = { key: string; title: string; emoji: string | null; tasks: Task[] };

/**
 * Group tasks by project or by area, following the area and project display
 * order, with a trailing "No project" / "No area" group.
 */
export function groupTasks(tasks: Task[], data: AreasData, by: "project" | "area"): TaskGroup[] {
  const index = indexProjects(data);
  const groups = new Map<string, TaskGroup>();
  const order: string[] = [];
  for (const a of data.areas) {
    if (by === "area") order.push(a.id);
    else for (const p of a.projects) order.push(p.id);
  }
  if (by === "project") for (const p of data.unsorted) order.push(p.id);
  const none = by === "project" ? "No project" : "No area";
  for (const t of tasks) {
    const entry = t.project_id ? index.get(t.project_id) : undefined;
    let key = "";
    let title = none;
    let emoji: string | null = null;
    if (entry && by === "project") {
      key = entry.project.id;
      title = entry.project.name;
      emoji = entry.project.emoji;
    } else if (entry?.area && by === "area") {
      key = entry.area.id;
      title = entry.area.name;
      emoji = entry.area.emoji;
    }
    const g = groups.get(key) ?? { key, title, emoji, tasks: [] };
    g.tasks.push(t);
    groups.set(key, g);
  }
  const rank = (k: string) => (k === "" ? Infinity : order.indexOf(k) === -1 ? order.length : order.indexOf(k));
  return [...groups.values()].sort((a, b) => rank(a.key) - rank(b.key));
}

/** "Task · Project" label for a timed task on the calendar. */
export function taskCalendarLabel(projectName: string | null | undefined) {
  return projectName ? `Task · ${projectName}` : "Task";
}

/** Case-insensitive match on project, area, course code or term. */
export function matchesProject(e: ProjectEntry, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [e.project.name, e.area?.name, e.project.course_code, e.project.term].some((s) => s?.toLowerCase().includes(q));
}

/* ---------- areas tree ---------- */

/** Named area colors (the same set bots pick avatar colors from). */
export const AREA_COLORS: Record<string, string> = {
  blue: "#1084fe",
  green: "#2fb26b",
  orange: "#ff8a1f",
  magenta: "#e5399b",
  violet: "#8b5cf6",
  cyan: "#12b5c8",
  red: "#ff4757",
  brown: "#a8754f",
};

const AREA_COLOR_LIST = Object.values(AREA_COLORS);

/**
 * An area's accent: its color when it's a known name or a hex value,
 * otherwise a steady pick from the palette based on its id.
 */
export function areaColor(area: { id: string; color?: string | null }): string {
  const c = area.color?.trim().toLowerCase();
  if (c && AREA_COLORS[c]) return AREA_COLORS[c];
  if (c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(c)) return c;
  let h = 0;
  for (const ch of area.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AREA_COLOR_LIST[h % AREA_COLOR_LIST.length];
}

export type TreeBranch = {
  /** The area id, or "none" for projects with no area. */
  key: string;
  area: AreaWithProjects | null;
  projects: ProjectWithCounts[];
};

const STATUS_RANK: Record<ProjectStatus, number> = { active: 0, paused: 1, done: 2 };

/**
 * Branches for the areas tree, in display order: areas, then a trailing
 * "No area" branch when it has projects. Projects sort active, paused, done,
 * with archived ones last. Archived areas and projects only show on request.
 */
export function treeBranches(data: AreasData, showArchived: boolean): TreeBranch[] {
  const order = (ps: ProjectWithCounts[]) =>
    ps
      .filter((p) => showArchived || !p.archived_at)
      .map((p, i) => ({ p, i }))
      .sort(
        (a, b) =>
          Number(!!a.p.archived_at) - Number(!!b.p.archived_at) ||
          STATUS_RANK[asStatus(a.p.status)] - STATUS_RANK[asStatus(b.p.status)] ||
          a.i - b.i,
      )
      .map(({ p }) => p);
  const branches: TreeBranch[] = data.areas
    .filter((a) => showArchived || !a.archived_at)
    .map((a) => ({ key: a.id, area: a, projects: order(a.projects) }));
  const loose = order(data.unsorted);
  if (loose.length) branches.push({ key: "none", area: null, projects: loose });
  return branches;
}
