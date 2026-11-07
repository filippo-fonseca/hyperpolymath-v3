import "server-only";
import { AppError, asJson, must, type Ctx, type Row, type Update, escapeLike } from "./ctx";
import { logAction } from "./log";
import { createTask, type TaskInput } from "./tasks";
import { projectIdFor } from "./projects";
import { describeSchedule, firstFire, nextFire, scheduleSchema, type Schedule } from "@/lib/schedule";

export type Capture = Row<"captures">;
/** A capture as lists return it: with how many replies it has. */
export type CaptureWithCount = Capture & { comment_count: number };

const URL_RE = /https?:\/\/[^\s<>"')]+/g;

export async function listCaptures(
  ctx: Ctx,
  opts: { query?: string; includeArchived?: boolean; limit?: number } = {},
): Promise<CaptureWithCount[]> {
  let q = ctx.db.from("captures").select().eq("user_id", ctx.userId).is("deleted_at", null);
  if (!opts.includeArchived) q = q.is("archived_at", null);
  if (opts.query) q = q.ilike("content", `%${escapeLike(opts.query)}%`);
  const rows = must(
    await q.order("created_at", { ascending: false }).limit(Math.min(opts.limit ?? 30, 200)),
    "list captures",
  );
  return withCommentCounts(ctx, rows);
}

/**
 * Captures that came back on their resurface schedule and haven't been marked
 * seen yet, newest first. They stay here until markCaptureSeen.
 */
export async function resurfacedCaptures(ctx: Ctx): Promise<CaptureWithCount[]> {
  const rows = must(
    await ctx.db
      .from("captures")
      .select()
      .eq("user_id", ctx.userId)
      .is("deleted_at", null)
      .is("archived_at", null)
      .not("resurfaced_at", "is", null)
      .order("resurfaced_at", { ascending: false })
      .limit(100),
    "resurfaced captures",
  );
  return withCommentCounts(ctx, rows);
}

/** Attach live (not deleted) reply counts in one extra query. */
async function withCommentCounts(ctx: Ctx, rows: Capture[]): Promise<CaptureWithCount[]> {
  if (!rows.length) return [];
  const comments = must(
    await ctx.db
      .from("capture_comments")
      .select("capture_id")
      .eq("user_id", ctx.userId)
      .is("deleted_at", null)
      .in("capture_id", rows.map((r) => r.id)),
    "comment counts",
  );
  const counts = new Map<string, number>();
  for (const c of comments) counts.set(c.capture_id, (counts.get(c.capture_id) ?? 0) + 1);
  return rows.map((r) => ({ ...r, comment_count: counts.get(r.id) ?? 0 }));
}

/**
 * Resurface columns for a schedule (or null to stop resurfacing). `startAt`
 * (an ISO instant) holds a repeating schedule back until then; for "every N
 * days" it is the first time it comes back, and the cadence steps from it.
 * Without it, an interval first comes back one interval from now.
 */
export function resurfaceValues(ctx: Ctx, schedule: Schedule | null, startAt?: string | null) {
  if (!schedule) return { resurface_schedule: null, resurface_next_at: null };
  const parsed = scheduleSchema.parse(schedule);
  const start = startAt ? new Date(startAt) : null;
  if (start && Number.isNaN(start.getTime())) throw new AppError("That start time isn't a valid date.");
  if (start && start <= ctx.now) throw new AppError("Pick a start time in the future.");
  let next: Date | null;
  if (parsed.type === "interval") next = start ?? nextFire(parsed, ctx.now, ctx.tz);
  else next = firstFire(parsed, start && start > ctx.now ? start : ctx.now, ctx.tz);
  if (!next) throw new AppError("That resurface time has already passed. Pick a time in the future.");
  return { resurface_schedule: asJson(parsed), resurface_next_at: next.toISOString() };
}

export async function createCapture(
  ctx: Ctx,
  input: { content: string; resurface?: Schedule | null; resurface_start?: string | null; project?: string | null },
) {
  const content = input.content.trim();
  if (!content) throw new AppError("Capture can't be empty.");
  const resurface = input.resurface ? resurfaceValues(ctx, input.resurface, input.resurface_start) : {};
  const capture = must(
    await ctx.db
      .from("captures")
      .insert({
        user_id: ctx.userId,
        content,
        urls: [...new Set(content.match(URL_RE) ?? [])],
        source: ctx.actor.name,
        ...resurface,
        project_id: (await projectIdFor(ctx, input.project)) ?? null,
      })
      .select()
      .single(),
    "create capture",
  );
  await logAction(ctx, {
    tool: "create_capture",
    entityType: "capture",
    entityId: capture.id,
    before: null,
    after: capture,
    summary: `Captured "${content.slice(0, 60)}${content.length > 60 ? "…" : ""}"`,
  });
  return capture;
}

export async function getCapture(ctx: Ctx, id: string) {
  return must(
    await ctx.db.from("captures").select().eq("id", id).eq("user_id", ctx.userId).is("deleted_at", null).maybeSingle(),
    `capture ${id}`,
  );
}

export async function updateCapture(
  ctx: Ctx,
  id: string,
  patch: {
    content?: string;
    resurface?: Schedule | null;
    /** ISO instant a repeating resurface schedule starts from (see resurfaceValues). */
    resurface_start?: string | null;
    archived?: boolean;
    project?: string | null;
  },
) {
  const before = await getCapture(ctx, id);
  const values: Update<"captures"> = {};
  const project_id = await projectIdFor(ctx, patch.project);
  if (project_id !== undefined) values.project_id = project_id;
  if (patch.content !== undefined) {
    values.content = patch.content.trim();
    values.urls = [...new Set(patch.content.match(URL_RE) ?? [])];
  }
  if (patch.resurface !== undefined) Object.assign(values, resurfaceValues(ctx, patch.resurface, patch.resurface_start));
  if (patch.archived !== undefined) values.archived_at = patch.archived ? ctx.now.toISOString() : null;
  const after = must(
    await ctx.db.from("captures").update(values).eq("id", id).eq("user_id", ctx.userId).select().single(),
    "update capture",
  );
  const onlyResurface =
    patch.resurface !== undefined &&
    Object.entries(patch).every(([k, v]) => k === "resurface" || k === "resurface_start" || v === undefined);
  const verb = patch.archived === true ? "Archived" : patch.archived === false ? "Unarchived" : "Updated";
  const summary = onlyResurface
    ? patch.resurface
      ? `Capture "${before.content.slice(0, 50)}" comes back ${describeSchedule(scheduleSchema.parse(patch.resurface))}`
      : `Stopped resurfacing "${before.content.slice(0, 50)}"`
    : `${verb} capture "${before.content.slice(0, 50)}"`;
  await logAction(ctx, {
    tool: onlyResurface ? "set_capture_resurface" : "update_capture",
    entityType: "capture",
    entityId: id,
    before,
    after,
    summary,
  });
  return after;
}

/** Schedule when a capture comes back (once, daily or every N minutes), or null to stop. */
export function setResurface(ctx: Ctx, id: string, schedule: Schedule | null, startAt?: string | null) {
  return updateCapture(ctx, id, { resurface: schedule, resurface_start: startAt });
}

/** Take a capture out of the Resurfaced section. Its schedule keeps running. */
export async function markCaptureSeen(ctx: Ctx, id: string) {
  const before = await getCapture(ctx, id);
  if (!before.resurfaced_at) return before;
  const after = must(
    await ctx.db.from("captures").update({ resurfaced_at: null }).eq("id", id).eq("user_id", ctx.userId).select().single(),
    "mark capture seen",
  );
  await logAction(ctx, {
    tool: "mark_capture_seen",
    entityType: "capture",
    entityId: id,
    before,
    after,
    summary: `Marked "${before.content.slice(0, 50)}" as seen`,
  });
  return after;
}

export async function deleteCapture(ctx: Ctx, id: string) {
  const before = await getCapture(ctx, id);
  const after = must(
    await ctx.db.from("captures").update({ deleted_at: ctx.now.toISOString() }).eq("id", id).select().single(),
    "delete capture",
  );
  await logAction(ctx, {
    tool: "delete_capture",
    entityType: "capture",
    entityId: id,
    before,
    after,
    summary: `Deleted capture "${before.content.slice(0, 50)}"`,
  });
  return { deleted: true };
}

/** Turn a capture into a task and archive the capture. */
export async function convertCaptureToTask(ctx: Ctx, id: string, task: Partial<TaskInput> = {}) {
  const capture = await getCapture(ctx, id);
  const firstLine = capture.content.split("\n")[0].slice(0, 200);
  const created = await createTask(ctx, {
    ...task,
    title: task.title ?? firstLine,
    project: task.project ?? capture.project_id ?? undefined,
    notes: task.notes ?? (capture.content.length > firstLine.length ? capture.content : null),
  });
  const after = must(
    await ctx.db
      .from("captures")
      .update({ converted_task_id: created.id, archived_at: ctx.now.toISOString() })
      .eq("id", id)
      .select()
      .single(),
    "archive capture",
  );
  await logAction(ctx, {
    tool: "convert_capture_to_task",
    entityType: "capture",
    entityId: id,
    before: capture,
    after,
    summary: `Turned capture into task "${created.title}"`,
  });
  return created;
}
