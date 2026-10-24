import { describe, expect, it } from "vitest";
import type { AreasData, Task } from "./dashboard-types";
import {
  DEFAULT_VIEWS,
  activeFilters,
  filterTasks,
  groupSections,
  isDefaultView,
  parseTaskViews,
  sortTasks,
} from "./task-view";

const task = (id: string, extra: Partial<Task> = {}) =>
  ({
    id,
    title: id,
    due_date: null,
    due_time: null,
    priority: 0,
    position: 0,
    project_id: null,
    created_at: "2026-10-01T00:00:00Z",
    ...extra,
  }) as Task;

const ids = (tasks: Task[]) => tasks.map((t) => t.id);
const today = "2026-10-24";
const noAreas = { areas: [], unsorted: [] } as unknown as AreasData;

describe("task view options", () => {
  it("defaults to priority order, with All grouped by priority", () => {
    expect(parseTaskViews(null)).toEqual(DEFAULT_VIEWS);
    expect(DEFAULT_VIEWS.today).toMatchObject({ sort: "priority", dir: "desc", group: "none" });
    expect(DEFAULT_VIEWS.all).toMatchObject({ sort: "due", dir: "asc", group: "priority" });
  });

  it("keeps good saved fields and drops bad ones", () => {
    const v = parseTaskViews({
      today: { sort: "title", dir: "sideways", group: "area", priorities: [1, 3, 3], due: "overdue" },
      all: { group: "project", project: "p-1", layout: "board" },
      junk: 1,
    });
    // Today can't group by area or filter by date, so those fall back.
    expect(v.today).toEqual({ ...DEFAULT_VIEWS.today, sort: "title", priorities: [3, 1] });
    expect(v.all).toEqual({ ...DEFAULT_VIEWS.all, group: "project", project: "p-1", layout: "board" });
    expect(v.upcoming).toEqual(DEFAULT_VIEWS.upcoming);
  });

  it("sorts by priority both ways, breaking ties by due date", () => {
    const rows = [
      task("p4"),
      task("p1 later", { priority: 3, due_date: "2026-10-30" }),
      task("p2", { priority: 2 }),
      task("p1 soon", { priority: 3, due_date: "2026-10-25" }),
    ];
    expect(ids(sortTasks(rows, "priority", "desc"))).toEqual(["p1 soon", "p1 later", "p2", "p4"]);
    expect(ids(sortTasks(rows, "priority", "asc"))).toEqual(["p4", "p2", "p1 soon", "p1 later"]);
  });

  it("sorts by due date and time, undated last in either direction", () => {
    const rows = [
      task("none"),
      task("late", { due_date: "2026-10-26" }),
      task("noon", { due_date: "2026-10-25", due_time: "12:00:00" }),
      task("untimed", { due_date: "2026-10-25" }),
      task("morning", { due_date: "2026-10-25", due_time: "08:00:00" }),
    ];
    expect(ids(sortTasks(rows, "due", "asc"))).toEqual(["morning", "noon", "untimed", "late", "none"]);
    expect(ids(sortTasks(rows, "due", "desc"))).toEqual(["late", "untimed", "noon", "morning", "none"]);
  });

  it("sorts names naturally and dates added newest first", () => {
    const rows = [task("item 10"), task("Item 2"), task("apple")];
    expect(ids(sortTasks(rows, "title", "asc"))).toEqual(["apple", "Item 2", "item 10"]);
    const added = [task("old", { created_at: "2026-01-01T00:00:00Z" }), task("new", { created_at: "2026-10-01T00:00:00Z" })];
    expect(ids(sortTasks(added, "created", "desc"))).toEqual(["new", "old"]);
  });

  it("filters by priority, project and due date", () => {
    const rows = [
      task("p1 work", { priority: 3, project_id: "work", due_date: "2026-10-20" }),
      task("p2 loose", { priority: 2, due_date: today }),
      task("p4 work", { project_id: "work", due_date: "2026-10-29" }),
      task("undated"),
    ];
    const p = DEFAULT_VIEWS.all;
    expect(ids(filterTasks(rows, { ...p, priorities: [3, 2] }, today))).toEqual(["p1 work", "p2 loose"]);
    expect(ids(filterTasks(rows, { ...p, project: "work" }, today))).toEqual(["p1 work", "p4 work"]);
    expect(ids(filterTasks(rows, { ...p, project: "none" }, today))).toEqual(["p2 loose", "undated"]);
    expect(ids(filterTasks(rows, { ...p, due: "overdue" }, today))).toEqual(["p1 work"]);
    expect(ids(filterTasks(rows, { ...p, due: "week" }, today))).toEqual(["p2 loose", "p4 work"]);
    expect(ids(filterTasks(rows, { ...p, due: "none" }, today))).toEqual(["undated"]);
  });

  it("groups by priority, P1 first, skipping empty bands", () => {
    const rows = [task("a", { priority: 3 }), task("b"), task("c", { priority: 3 })];
    const sections = groupSections(rows, "priority", today, noAreas);
    expect(sections.map((s) => [s.title, ids(s.tasks)])).toEqual([
      ["Priority 1", ["a", "c"]],
      ["No priority", ["b"]],
    ]);
  });

  it("counts filters and spots changes from the defaults", () => {
    const p = { ...DEFAULT_VIEWS.today, priorities: [3], project: "work" };
    expect(activeFilters(p)).toBe(2);
    expect(isDefaultView("today", DEFAULT_VIEWS.today)).toBe(true);
    expect(isDefaultView("today", { ...DEFAULT_VIEWS.today, dir: "asc" })).toBe(false);
  });
});
