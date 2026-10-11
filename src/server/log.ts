import "server-only";
import { asJson, AppError, must, type Ctx, type Row } from "./ctx";

// The audit log. Every write records before/after snapshots so the activity
// view can show what happened and revert it.

export type EntityType = "task" | "reminder" | "habit" | "habit_log" | "capture" | "widget" | "bot" | "event";

const TABLE: Record<Exclude<EntityType, "event">, "tasks" | "reminders" | "habits" | "habit_logs" | "captures" | "widgets" | "bots"> = {
  task: "tasks",
  reminder: "reminders",
  habit: "habits",
  habit_log: "habit_logs",
  capture: "captures",
  widget: "widgets",
  bot: "bots",
};

// Tables where "create" is undone by soft delete rather than a hard delete.
const SOFT_DELETE = new Set<EntityType>(["task", "capture", "widget"]);
const IMMUTABLE = new Set(["id", "user_id", "created_at", "updated_at"]);

export async function logAction(
  ctx: Ctx,
  a: {
    tool: string;
    entityType: EntityType;
    entityId: string | null;
    before: unknown;
    after: unknown;
    summary: string;
  },
): Promise<Row<"actions">> {
  return must(
    await ctx.db
      .from("actions")
      .insert({
        user_id: ctx.userId,
        actor_kind: ctx.actor.kind,
        bot_id: ctx.actor.kind === "bot" ? ctx.actor.botId : null,
        tool: a.tool,
        entity_type: a.entityType,
        entity_id: a.entityId,
        before: asJson(a.before ?? null),
        after: asJson(a.after ?? null),
        summary: a.summary,
      })
      .select()
      .single(),
    "log action",
  );
}

export async function listActions(
  ctx: Ctx,
  opts: { botId?: string; limit?: number; before?: string } = {},
) {
  let q = ctx.db
    .from("actions")
    .select("*, bot:bots(id, name, avatar_shape, avatar_color)")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(Math.min(opts.limit ?? 50, 200));
  if (opts.botId) q = q.eq("bot_id", opts.botId);
  if (opts.before) q = q.lt("created_at", opts.before);
  return must(await q, "list actions");
}

/**
 * Undo an action by restoring its before snapshot. Refuses if the row changed
 * since the action (someone else edited it) unless `force` is set.
 */
export async function revertAction(ctx: Ctx, actionId: string, force = false) {
  const action = must(
    await ctx.db.from("actions").select().eq("id", actionId).eq("user_id", ctx.userId).maybeSingle(),
    "action",
  );
  if (action.reverted_at) throw new AppError("That action was already reverted.", "conflict");
  if (!action.entity_id) throw new AppError("That action can't be reverted.");
  const type = action.entity_type as EntityType;
  if (type === "event") {
    // Calendar events live in Google; the calendar module knows how to undo them.
    const { revertEventAction } = await import("./google/calendar");
    const { restored, current } = await revertEventAction(ctx, action, force);
    return finishRevert(ctx, action, type, current, restored);
  }
  const table = TABLE[type];
  if (!table) throw new AppError(`Unknown entity type ${action.entity_type}`);

  const before = action.before as Record<string, unknown> | null;
  const after = action.after as Record<string, unknown> | null;
  const { data: current } = await ctx.db.from(table).select().eq("id", action.entity_id).maybeSingle();
  const cur = current as Record<string, unknown> | null;

  if (!force && cur && after && cur.updated_at && after.updated_at && cur.updated_at !== after.updated_at) {
    throw new AppError(
      "This item changed after that action. Revert anyway with force, or revert the later action first.",
      "conflict",
    );
  }

  let restored: unknown = null;
  if (!before) {
    // Undo a create.
    if (SOFT_DELETE.has(type)) {
      restored = must(
        await ctx.db
          .from(table as "tasks")
          .update({ deleted_at: ctx.now.toISOString() })
          .eq("id", action.entity_id)
          .select()
          .single(),
        "revert create",
      );
    } else {
      await ctx.db.from(table).delete().eq("id", action.entity_id);
    }
  } else if (!cur) {
    // Row was hard-deleted: put it back.
    restored = must(await ctx.db.from(table as "tasks").insert(before as never).select().single(), "revert delete");
  } else {
    const patch = Object.fromEntries(Object.entries(before).filter(([k]) => !IMMUTABLE.has(k)));
    restored = must(
      await ctx.db
        .from(table as "tasks")
        .update(patch as never)
        .eq("id", action.entity_id)
        .select()
        .single(),
      "revert update",
    );
  }

  return finishRevert(ctx, action, type, cur, restored);
}

async function finishRevert(ctx: Ctx, action: Row<"actions">, type: EntityType, current: unknown, restored: unknown) {
  const undo = await logAction(ctx, {
    tool: "revert_action",
    entityType: type,
    entityId: action.entity_id,
    before: current,
    after: restored,
    summary: `Reverted: ${action.summary}`,
  });
  await ctx.db
    .from("actions")
    .update({ reverted_at: ctx.now.toISOString(), reverted_by: undo.id })
    .eq("id", action.id);
  return { reverted: action.summary, entity_type: type, entity_id: action.entity_id };
}
