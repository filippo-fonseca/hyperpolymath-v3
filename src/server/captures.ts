import "server-only";
import { AppError, must, type Ctx, type Row, type Update, escapeLike } from "./ctx";
import { logAction } from "./log";
import { createTask, type TaskInput } from "./tasks";
import { localDate } from "@/lib/time";

export type Capture = Row<"captures">;

const URL_RE = /https?:\/\/[^\s<>"')]+/g;

export async function listCaptures(
  ctx: Ctx,
  opts: { query?: string; includeArchived?: boolean; limit?: number } = {},
): Promise<Capture[]> {
  let q = ctx.db.from("captures").select().eq("user_id", ctx.userId).is("deleted_at", null);
  if (!opts.includeArchived) q = q.is("archived_at", null);
  if (opts.query) q = q.ilike("content", `%${escapeLike(opts.query)}%`);
  return must(
    await q.order("created_at", { ascending: false }).limit(Math.min(opts.limit ?? 30, 200)),
    "list captures",
  );
}

/** Captures whose resurface date has arrived. */
export async function resurfacingCaptures(ctx: Ctx): Promise<Capture[]> {
  return must(
    await ctx.db
      .from("captures")
      .select()
      .eq("user_id", ctx.userId)
      .is("deleted_at", null)
      .is("archived_at", null)
      .lte("resurface_at", localDate(ctx.now, ctx.tz))
      .order("resurface_at"),
    "resurfacing captures",
  );
}

export async function createCapture(ctx: Ctx, input: { content: string; resurface_at?: string | null }) {
  const content = input.content.trim();
  if (!content) throw new AppError("Capture can't be empty.");
  const capture = must(
    await ctx.db
      .from("captures")
      .insert({
        user_id: ctx.userId,
        content,
        urls: [...new Set(content.match(URL_RE) ?? [])],
        source: ctx.actor.name,
        resurface_at: input.resurface_at ?? null,
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

async function getCapture(ctx: Ctx, id: string) {
  return must(
    await ctx.db.from("captures").select().eq("id", id).eq("user_id", ctx.userId).is("deleted_at", null).maybeSingle(),
    `capture ${id}`,
  );
}

export async function updateCapture(
  ctx: Ctx,
  id: string,
  patch: { content?: string; resurface_at?: string | null; archived?: boolean },
) {
  const before = await getCapture(ctx, id);
  const values: Update<"captures"> = {};
  if (patch.content !== undefined) {
    values.content = patch.content.trim();
    values.urls = [...new Set(patch.content.match(URL_RE) ?? [])];
  }
  if (patch.resurface_at !== undefined) values.resurface_at = patch.resurface_at;
  if (patch.archived !== undefined) values.archived_at = patch.archived ? ctx.now.toISOString() : null;
  const after = must(await ctx.db.from("captures").update(values).eq("id", id).select().single(), "update capture");
  const verb = patch.archived === true ? "Archived" : patch.archived === false ? "Unarchived" : "Updated";
  await logAction(ctx, {
    tool: "update_capture",
    entityType: "capture",
    entityId: id,
    before,
    after,
    summary: `${verb} capture "${before.content.slice(0, 50)}"`,
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
