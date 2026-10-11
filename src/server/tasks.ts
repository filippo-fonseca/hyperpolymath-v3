import "server-only";
import { AppError, asJson, must, type Ctx, type Row, type Update, escapeLike } from "./ctx";
import { logAction } from "./log";
import { projectIdFor } from "./projects";
import { nextOccurrence, recurrenceSchema, type Recurrence } from "@/lib/recurrence";
import { addDays, localDate } from "@/lib/time";

export type Task = Row<"tasks">;

export type TaskInput = {
  title?: string;
  notes?: string | null;
  status?: "todo" | "doing" | "done";
  priority?: number;
  /** Project name or id; null clears. */
  project?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  recurrence?: Recurrence | null;
};

export type TaskScope = "today" | "overdue" | "upcoming" | "inbox" | "open" | "done" | "all";

export async function getTask(ctx: Ctx, id: string): Promise<Task> {
  return must(
    await ctx.db.from("tasks").select().eq("id", id).eq("user_id", ctx.userId).is("deleted_at", null).maybeSingle(),
    `task ${id}`,
  );
}

export async function listTasks(
  ctx: Ctx,
  opts: { scope?: TaskScope; project?: string; area?: string; query?: string; limit?: number } = {},
): Promise<Task[]> {
  const today = localDate(ctx.now, ctx.tz);
  let q = ctx.db.from("tasks").select().eq("user_id", ctx.userId).is("deleted_at", null);
  switch (opts.scope ?? "open") {
    case "today":
      q = q.neq("status", "done").lte("due_date", today);
      break;
    case "overdue":
      q = q.neq("status", "done").lt("due_date", today);
      break;
    case "upcoming":
      q = q.neq("status", "done").gt("due_date", today).lte("due_date", addDays(today, 14));
      break;
    case "inbox":
      q = q.neq("status", "done").is("due_date", null);
      break;
    case "open":
      q = q.neq("status", "done");
      break;
    case "done":
      q = q.eq("status", "done");
      break;
  }
  if (opts.project) q = q.eq("project_id", (await projectIdFor(ctx, opts.project))!);
  if (opts.area) {
    const { findArea } = await import("./projects");
    const area = await findArea(ctx, opts.area);
    const { data: ps } = await ctx.db.from("projects").select("id").eq("user_id", ctx.userId).eq("area_id", area.id).is("deleted_at", null);
    q = q.in("project_id", (ps ?? []).map((p) => p.id));
  }
  if (opts.query) q = q.ilike("title", `%${escapeLike(opts.query)}%`);
  const order = opts.scope === "done" ? "completed_at" : "due_date";
  q = q
    .order(order, { ascending: opts.scope !== "done", nullsFirst: false })
    .order("priority", { ascending: false })
    .order("position")
    .limit(Math.min(opts.limit ?? 100, 500));
  return must(await q, "list tasks");
}

function clean(input: TaskInput): Update<"tasks"> {
  const out: Update<"tasks"> = {};
  if (input.title !== undefined) {
    const t = input.title.trim();
    if (!t) throw new AppError("Task title can't be empty.");
    out.title = t;
  }
  if (input.notes !== undefined) out.notes = input.notes;
  if (input.status !== undefined) out.status = input.status;
  if (input.priority !== undefined) out.priority = Math.max(0, Math.min(3, Math.round(input.priority)));
  if (input.due_date !== undefined) out.due_date = input.due_date;
  if (input.due_time !== undefined) out.due_time = input.due_time;
  if (input.recurrence !== undefined) {
    const rule = input.recurrence ? recurrenceSchema.parse(input.recurrence) : null;
    // Monthly rules remember their day so Jan 31 -> Feb 28 -> Mar 31, not Mar 28.
    if (rule?.freq === "monthly" && !rule.month_day && input.due_date) rule.month_day = Number(input.due_date.slice(8, 10));
    out.recurrence = rule ? asJson(rule) : null;
  }
  return out;
}

export async function createTask(ctx: Ctx, input: TaskInput & { title: string }): Promise<Task> {
  const values = clean(input);
  const project_id = await projectIdFor(ctx, input.project);
  if (project_id !== undefined) values.project_id = project_id;
  const task = must(
    await ctx.db
      .from("tasks")
      .insert({
        ...values,
        title: values.title!,
        user_id: ctx.userId,
        created_by: ctx.actor.name,
        position: -ctx.now.getTime(),
        completed_at: values.status === "done" ? ctx.now.toISOString() : null,
      })
      .select()
      .single(),
    "create task",
  );
  await logAction(ctx, {
    tool: "create_task",
    entityType: "task",
    entityId: task.id,
    before: null,
    after: task,
    summary: `Created task "${task.title}"`,
  });
  return task;
}

export async function updateTask(ctx: Ctx, id: string, input: TaskInput): Promise<Task> {
  const before = await getTask(ctx, id);
  const values = clean(input);
  const project_id = await projectIdFor(ctx, input.project);
  if (project_id !== undefined) values.project_id = project_id;
  if (values.status === "done" && before.status !== "done") {
    // Apply any other edits first, then complete (which handles recurrence).
    const { status: _done, ...rest } = values;
    void _done;
    if (Object.keys(rest).length) await updateTask(ctx, id, { ...input, status: undefined });
    return completeTask(ctx, id);
  }
  if (values.status && values.status !== "done") values.completed_at = null;
  const after = must(
    await ctx.db.from("tasks").update(values).eq("id", id).select().single(),
    "update task",
  );
  const changed = Object.keys(values).filter((k) => k !== "completed_at");
  await logAction(ctx, {
    tool: "update_task",
    entityType: "task",
    entityId: id,
    before,
    after,
    summary: `Updated "${after.title}" (${changed.join(", ")})`,
  });
  return after;
}

/**
 * Mark done. Recurring tasks roll forward to their next occurrence instead
 * and stay open.
 */
export async function completeTask(ctx: Ctx, id: string): Promise<Task> {
  const before = await getTask(ctx, id);
  if (before.status === "done") return before;
  const rule = before.recurrence ? recurrenceSchema.safeParse(before.recurrence) : null;
  let values: Update<"tasks">;
  let summary: string;
  if (rule?.success) {
    const from = before.due_date ?? localDate(ctx.now, ctx.tz);
    let next = nextOccurrence(rule.data, from);
    const today = localDate(ctx.now, ctx.tz);
    // Don't leave a recurring task stuck in the past after a long gap.
    for (let i = 0; next <= today && i < 400; i++) next = nextOccurrence(rule.data, next);
    values = { due_date: next, status: "todo", completed_at: null };
    summary = `Completed "${before.title}" (next on ${next})`;
  } else {
    values = { status: "done", completed_at: ctx.now.toISOString() };
    summary = `Completed "${before.title}"`;
  }
  const after = must(await ctx.db.from("tasks").update(values).eq("id", id).select().single(), "complete task");
  await logAction(ctx, { tool: "complete_task", entityType: "task", entityId: id, before, after, summary });
  return after;
}

export async function reopenTask(ctx: Ctx, id: string): Promise<Task> {
  return updateTask(ctx, id, { status: "todo" });
}

export async function deleteTask(ctx: Ctx, id: string) {
  const before = await getTask(ctx, id);
  const after = must(
    await ctx.db.from("tasks").update({ deleted_at: ctx.now.toISOString() }).eq("id", id).select().single(),
    "delete task",
  );
  await ctx.db.from("reminders").update({ active: false }).eq("task_id", id);
  await logAction(ctx, {
    tool: "delete_task",
    entityType: "task",
    entityId: id,
    before,
    after,
    summary: `Deleted task "${before.title}"`,
  });
  return { deleted: before.title };
}
