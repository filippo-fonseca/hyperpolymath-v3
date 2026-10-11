import "server-only";
import { AppError, escapeLike, must, type Ctx, type Row, type Update } from "./ctx";
import { logAction } from "./log";

// Life areas and projects, grouped like v2: every project sits in an area,
// tasks and captures can belong to a project, habits to an area.

export type Area = Row<"areas">;
export type Project = Row<"projects">;
export type ProjectStatus = "active" | "paused" | "done";

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export async function findArea(ctx: Ctx, idOrName: string): Promise<Area> {
  const q = ctx.db.from("areas").select().eq("user_id", ctx.userId).is("deleted_at", null);
  const { data } = isUuid(idOrName)
    ? await q.eq("id", idOrName).maybeSingle()
    : await q.ilike("name", escapeLike(idOrName.trim())).limit(1).maybeSingle();
  if (!data) throw new AppError(`No area "${idOrName}". Use list_areas.`, "not_found");
  return data;
}

export async function findProject(ctx: Ctx, idOrName: string): Promise<Project> {
  const q = ctx.db.from("projects").select().eq("user_id", ctx.userId).is("deleted_at", null);
  const { data } = isUuid(idOrName)
    ? await q.eq("id", idOrName).maybeSingle()
    : await q.ilike("name", escapeLike(idOrName.trim())).order("archived_at", { nullsFirst: true }).limit(1).maybeSingle();
  if (!data) throw new AppError(`No project "${idOrName}". Use list_areas to see projects.`, "not_found");
  return data;
}

/** Resolve a project reference to an id (null clears, undefined leaves unchanged). */
export async function projectIdFor(ctx: Ctx, ref: string | null | undefined) {
  if (ref === undefined) return undefined;
  if (ref === null || ref === "") return null;
  return (await findProject(ctx, ref)).id;
}

/** Areas with their projects and open-task counts, in display order. */
export async function listAreas(ctx: Ctx, opts: { includeArchived?: boolean } = {}) {
  let aq = ctx.db.from("areas").select().eq("user_id", ctx.userId).is("deleted_at", null);
  let pq = ctx.db.from("projects").select().eq("user_id", ctx.userId).is("deleted_at", null);
  if (!opts.includeArchived) {
    aq = aq.is("archived_at", null);
    pq = pq.is("archived_at", null);
  }
  const [areas, projects, tasks] = await Promise.all([
    must(await aq.order("position").order("created_at"), "list areas"),
    must(await pq.order("position").order("created_at"), "list projects"),
    must(
      await ctx.db
        .from("tasks")
        .select("project_id, status")
        .eq("user_id", ctx.userId)
        .is("deleted_at", null)
        .not("project_id", "is", null),
      "project task counts",
    ),
  ]);
  const counts = new Map<string, { open: number; done: number }>();
  for (const t of tasks) {
    const c = counts.get(t.project_id!) ?? { open: 0, done: 0 };
    if (t.status === "done") c.done++;
    else c.open++;
    counts.set(t.project_id!, c);
  }
  const withCounts = projects.map((p) => ({ ...p, open_tasks: counts.get(p.id)?.open ?? 0, done_tasks: counts.get(p.id)?.done ?? 0 }));
  return {
    areas: areas.map((a) => ({ ...a, projects: withCounts.filter((p) => p.area_id === a.id) })),
    unsorted: withCounts.filter((p) => !p.area_id || !areas.some((a) => a.id === p.area_id)),
  };
}

// Areas ---------------------------------------------------------------------

export async function createArea(ctx: Ctx, input: { name: string; emoji?: string | null; color?: string | null }) {
  const name = input.name.trim();
  if (!name) throw new AppError("Area name can't be empty.");
  const area = must(
    await ctx.db
      .from("areas")
      .insert({ user_id: ctx.userId, name, emoji: input.emoji ?? null, color: input.color ?? null, position: ctx.now.getTime() })
      .select()
      .single(),
    "create area",
  );
  await logAction(ctx, { tool: "create_area", entityType: "area", entityId: area.id, before: null, after: area, summary: `Created area "${name}"` });
  return area;
}

export async function updateArea(
  ctx: Ctx,
  idOrName: string,
  patch: { name?: string; emoji?: string | null; color?: string | null; position?: number; archived?: boolean },
) {
  const before = await findArea(ctx, idOrName);
  const values: Update<"areas"> = {};
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.emoji !== undefined) values.emoji = patch.emoji;
  if (patch.color !== undefined) values.color = patch.color;
  if (patch.position !== undefined) values.position = patch.position;
  if (patch.archived !== undefined) values.archived_at = patch.archived ? ctx.now.toISOString() : null;
  const after = must(
    await ctx.db.from("areas").update(values).eq("id", before.id).eq("user_id", ctx.userId).select().single(),
    "update area",
  );
  const verb = patch.archived === true ? "Archived" : patch.archived === false ? "Restored" : "Updated";
  await logAction(ctx, { tool: "update_area", entityType: "area", entityId: before.id, before, after, summary: `${verb} area "${after.name}"` });
  return after;
}

export async function deleteArea(ctx: Ctx, idOrName: string) {
  const before = await findArea(ctx, idOrName);
  const after = must(
    await ctx.db.from("areas").update({ deleted_at: ctx.now.toISOString() }).eq("id", before.id).eq("user_id", ctx.userId).select().single(),
    "delete area",
  );
  await logAction(ctx, { tool: "delete_area", entityType: "area", entityId: before.id, before, after, summary: `Deleted area "${before.name}"` });
  return { deleted: before.name };
}

// Projects ------------------------------------------------------------------

export type ProjectInput = {
  name?: string;
  area?: string | null; // area name or id
  description?: string | null;
  emoji?: string | null;
  status?: ProjectStatus;
  start_date?: string | null;
  end_date?: string | null;
  is_class?: boolean;
  course_code?: string | null;
  term?: string | null;
  position?: number;
};

async function projectValues(ctx: Ctx, input: ProjectInput): Promise<Update<"projects">> {
  const v: Update<"projects"> = {};
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) throw new AppError("Project name can't be empty.");
    v.name = n;
  }
  if (input.area !== undefined) v.area_id = input.area ? (await findArea(ctx, input.area)).id : null;
  for (const k of ["description", "emoji", "status", "start_date", "end_date", "is_class", "course_code", "term", "position"] as const) {
    if (input[k] !== undefined) (v as Record<string, unknown>)[k] = input[k];
  }
  return v;
}

export async function createProject(ctx: Ctx, input: ProjectInput & { name: string }) {
  const values = await projectValues(ctx, input);
  const project = must(
    await ctx.db
      .from("projects")
      .insert({ ...values, name: values.name!, user_id: ctx.userId, position: input.position ?? ctx.now.getTime() })
      .select()
      .single(),
    "create project",
  );
  await logAction(ctx, {
    tool: "create_project",
    entityType: "project",
    entityId: project.id,
    before: null,
    after: project,
    summary: `Created project "${project.name}"`,
  });
  return project;
}

export async function updateProject(ctx: Ctx, idOrName: string, input: ProjectInput & { archived?: boolean }) {
  const before = await findProject(ctx, idOrName);
  const values = await projectValues(ctx, input);
  if (input.archived !== undefined) values.archived_at = input.archived ? ctx.now.toISOString() : null;
  const after = must(
    await ctx.db.from("projects").update(values).eq("id", before.id).eq("user_id", ctx.userId).select().single(),
    "update project",
  );
  let summary = `Updated project "${after.name}"`;
  if (input.status && input.status !== before.status) summary = `Marked project "${after.name}" ${input.status}`;
  if (input.archived === true) summary = `Archived project "${after.name}"`;
  if (input.area !== undefined && after.area_id !== before.area_id) summary = `Moved project "${after.name}" to another area`;
  await logAction(ctx, { tool: "update_project", entityType: "project", entityId: before.id, before, after, summary });
  return after;
}

export async function deleteProject(ctx: Ctx, idOrName: string) {
  const before = await findProject(ctx, idOrName);
  const after = must(
    await ctx.db.from("projects").update({ deleted_at: ctx.now.toISOString() }).eq("id", before.id).eq("user_id", ctx.userId).select().single(),
    "delete project",
  );
  await logAction(ctx, { tool: "delete_project", entityType: "project", entityId: before.id, before, after, summary: `Deleted project "${before.name}"` });
  return { deleted: before.name };
}

/** A project with its open tasks and recent captures. */
export async function getProject(ctx: Ctx, idOrName: string) {
  const project = await findProject(ctx, idOrName);
  const [tasks, captures, area] = await Promise.all([
    must(
      await ctx.db
        .from("tasks")
        .select()
        .eq("user_id", ctx.userId)
        .eq("project_id", project.id)
        .is("deleted_at", null)
        .order("status")
        .order("due_date", { nullsFirst: false })
        .limit(200),
      "project tasks",
    ),
    must(
      await ctx.db
        .from("captures")
        .select()
        .eq("user_id", ctx.userId)
        .eq("project_id", project.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20),
      "project captures",
    ),
    project.area_id
      ? ctx.db.from("areas").select("id, name, emoji").eq("id", project.area_id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);
  return { ...project, area, tasks, captures };
}
