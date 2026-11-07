import { describe, expect, it } from "vitest";
import type { AreasData, Task } from "./dashboard-types";
import {
  AREA_COLORS,
  areaColor,
  classLabel,
  dateRangeLabel,
  groupTasks,
  indexProjects,
  isLive,
  matchesProject,
  progressOf,
  taskCalendarLabel,
  treeBranches,
} from "./projects";

const project = (id: string, area_id: string | null, extra: Record<string, unknown> = {}) =>
  ({
    id,
    area_id,
    name: `Project ${id}`,
    emoji: null,
    status: "active",
    archived_at: null,
    is_class: false,
    course_code: null,
    term: null,
    start_date: null,
    end_date: null,
    open_tasks: 0,
    done_tasks: 0,
    ...extra,
  }) as unknown as AreasData["unsorted"][number];

const data = {
  areas: [
    { id: "a1", name: "School", emoji: "🎓", projects: [project("p1", "a1"), project("p2", "a1")] },
    { id: "a2", name: "Health", emoji: "🏃", projects: [project("p3", "a2")] },
  ],
  unsorted: [project("p4", null)],
} as unknown as AreasData;

const task = (id: string, project_id: string | null) => ({ id, project_id }) as unknown as Task;

describe("projects", () => {
  it("indexes every project with its area", () => {
    const idx = indexProjects(data);
    expect(idx.get("p3")?.area?.name).toBe("Health");
    expect(idx.get("p4")?.area).toBeNull();
  });

  it("computes progress and liveness", () => {
    expect(progressOf({ open_tasks: 1, done_tasks: 3 })).toBe(0.75);
    expect(progressOf({ open_tasks: 0, done_tasks: 0 })).toBe(0);
    expect(isLive({ archived_at: null, status: "paused" })).toBe(true);
    expect(isLive({ archived_at: null, status: "done" })).toBe(false);
    expect(isLive({ archived_at: "2026-10-01T00:00:00Z", status: "active" })).toBe(false);
  });

  it("labels classes and date ranges", () => {
    expect(classLabel({ is_class: true, course_code: "CS 223", term: "Fall 2026" })).toBe("CS 223 · Fall 2026");
    expect(classLabel({ is_class: false, course_code: "CS 223", term: null })).toBeNull();
    expect(dateRangeLabel({ start_date: "2026-09-02", end_date: "2026-12-12" })).toBe("Sep 2 to Dec 12");
    expect(dateRangeLabel({ start_date: null, end_date: "2026-12-12" })).toBe("Until Dec 12");
  });

  it("groups tasks by project and by area in display order", () => {
    const tasks = [task("t1", "p3"), task("t2", null), task("t3", "p1"), task("t4", "p2")];
    expect(groupTasks(tasks, data, "project").map((g) => g.title)).toEqual(["Project p1", "Project p2", "Project p3", "No project"]);
    const byArea = groupTasks(tasks, data, "area");
    expect(byArea.map((g) => [g.title, g.tasks.length])).toEqual([["School", 2], ["Health", 1], ["No area", 1]]);
  });

  it("labels timed tasks on the calendar with their project", () => {
    expect(taskCalendarLabel("Thesis")).toBe("Task · Thesis");
    expect(taskCalendarLabel(null)).toBe("Task");
  });

  it("searches by project, area or course", () => {
    const e = indexProjects(data).get("p1")!;
    expect(matchesProject(e, "school")).toBe(true);
    expect(matchesProject(e, "nope")).toBe(false);
  });

  it("picks an area color from a name, a hex value or the id", () => {
    expect(areaColor({ id: "a1", color: "Green" })).toBe("#2fb26b");
    expect(areaColor({ id: "a1", color: "#ABC" })).toBe("#abc");
    const fallback = areaColor({ id: "a1", color: "not a color" });
    expect(Object.values(AREA_COLORS)).toContain(fallback);
    expect(areaColor({ id: "a1", color: null })).toBe(fallback);
  });

  it("builds tree branches with archived ones only on request", () => {
    const tree = {
      areas: [
        {
          id: "a1",
          name: "School",
          archived_at: null,
          projects: [
            project("p1", "a1", { status: "done" }),
            project("p2", "a1", { archived_at: "2026-10-01T00:00:00Z" }),
            project("p3", "a1", { status: "paused" }),
            project("p4", "a1"),
          ],
        },
        { id: "a2", name: "Old", archived_at: "2026-10-01T00:00:00Z", projects: [project("p5", "a2")] },
      ],
      unsorted: [],
    } as unknown as AreasData;
    const live = treeBranches(tree, false);
    expect(live.map((b) => b.key)).toEqual(["a1"]);
    expect(live[0].projects.map((p) => p.id)).toEqual(["p4", "p3", "p1"]);
    const all = treeBranches(tree, true);
    expect(all.map((b) => b.key)).toEqual(["a1", "a2"]);
    expect(all[0].projects.map((p) => p.id)).toEqual(["p4", "p3", "p1", "p2"]);
    expect(treeBranches(data, false).at(-1)).toMatchObject({ key: "none", area: null });
  });
});
