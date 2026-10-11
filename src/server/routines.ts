import "server-only";
import { AppError, escapeLike, must, type Ctx, type Row, type Update } from "./ctx";
import { logAction } from "./log";
import { resolveBotActor } from "./bots";

// Routines run in Grok Bot. Bots register them here so the app can show every
// bot's routines, link them to widgets, and switch them on or off: a bot calls
// startRun at the beginning of every run and stops when the routine is off.

export type Routine = Row<"routines">;

const ROUTINE_SELECT =
  "*, bot:bots(id, name, avatar_shape, avatar_color, is_coordinator), widget:widgets(id, title, kind)";

export async function listRoutines(ctx: Ctx, opts: { botId?: string } = {}) {
  let q = ctx.db.from("routines").select(ROUTINE_SELECT).eq("user_id", ctx.userId).is("deleted_at", null);
  if (opts.botId) q = q.eq("bot_id", opts.botId);
  return must(await q.order("created_at"), "list routines");
}

export async function getRoutine(ctx: Ctx, id: string): Promise<Routine> {
  return must(
    await ctx.db.from("routines").select().eq("id", id).eq("user_id", ctx.userId).is("deleted_at", null).maybeSingle(),
    `routine ${id}`,
  );
}

/** Find a routine by id, or by name among the acting bot's routines (then anyone's). */
async function findRoutine(ctx: Ctx, idOrName: string): Promise<Routine> {
  if (/^[0-9a-f-]{36}$/i.test(idOrName)) return getRoutine(ctx, idOrName);
  const base = () =>
    ctx.db
      .from("routines")
      .select()
      .eq("user_id", ctx.userId)
      .is("deleted_at", null)
      .ilike("name", escapeLike(idOrName));
  if (ctx.actor.kind === "bot") {
    const { data } = await base().eq("bot_id", ctx.actor.botId).maybeSingle();
    if (data) return data;
  }
  const { data } = await base().limit(1).maybeSingle();
  if (!data) throw new AppError(`No routine "${idOrName}". Use list_routines.`, "not_found");
  return data;
}

async function widgetIdFor(ctx: Ctx, widget: string | null | undefined) {
  if (widget === undefined) return undefined;
  if (widget === null) return null;
  const isUuid = /^[0-9a-f-]{36}$/i.test(widget);
  const q = ctx.db.from("widgets").select("id").eq("user_id", ctx.userId).is("deleted_at", null);
  const { data } = isUuid ? await q.eq("id", widget).maybeSingle() : await q.ilike("title", escapeLike(widget)).limit(1).maybeSingle();
  if (!data) throw new AppError(`No widget "${widget}". Create it first with create_widget.`, "not_found");
  return data.id;
}

export type RoutineInput = {
  name: string;
  description?: string | null;
  schedule?: string | null;
  widget?: string | null;
  grokbot_routine_id?: string | null;
  enabled?: boolean;
};

/**
 * Register (or update) a routine owned by a bot. Bots call this for every
 * routine they run; the owner defaults to the acting bot.
 */
export async function registerRoutine(ctx: Ctx, input: RoutineInput & { bot?: string }) {
  const name = input.name.trim();
  if (!name) throw new AppError("Routine name can't be empty.");
  let botId: string;
  if (input.bot) {
    const owner = await resolveBotActor(ctx.db, ctx.userId, input.bot);
    if (owner.kind !== "bot") throw new AppError("Routines belong to a bot.");
    botId = owner.botId;
  } else if (ctx.actor.kind === "bot") {
    botId = ctx.actor.botId;
  } else {
    throw new AppError("Say which bot owns this routine.");
  }
  const widget_id = await widgetIdFor(ctx, input.widget);
  const { data: existing } = await ctx.db
    .from("routines")
    .select()
    .eq("user_id", ctx.userId)
    .eq("bot_id", botId)
    .ilike("name", escapeLike(name))
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) return updateRoutine(ctx, existing.id, { ...input, name });

  const routine = must(
    await ctx.db
      .from("routines")
      .insert({
        user_id: ctx.userId,
        bot_id: botId,
        name,
        description: input.description ?? null,
        schedule: input.schedule ?? null,
        widget_id: widget_id ?? null,
        grokbot_routine_id: input.grokbot_routine_id ?? null,
        enabled: input.enabled ?? true,
      })
      .select()
      .single(),
    "register routine",
  );
  await logAction(ctx, {
    tool: "register_routine",
    entityType: "routine",
    entityId: routine.id,
    before: null,
    after: routine,
    summary: `Registered routine "${name}"${routine.schedule ? ` (${routine.schedule})` : ""}`,
  });
  return routine;
}

export async function updateRoutine(ctx: Ctx, idOrName: string, input: Partial<RoutineInput>) {
  const before = await findRoutine(ctx, idOrName);
  const values: Update<"routines"> = {};
  if (input.name !== undefined) values.name = input.name.trim();
  if (input.description !== undefined) values.description = input.description;
  if (input.schedule !== undefined) values.schedule = input.schedule;
  if (input.grokbot_routine_id !== undefined) values.grokbot_routine_id = input.grokbot_routine_id;
  if (input.enabled !== undefined) values.enabled = input.enabled;
  const widget_id = await widgetIdFor(ctx, input.widget);
  if (widget_id !== undefined) values.widget_id = widget_id;
  const after = must(
    await ctx.db.from("routines").update(values).eq("id", before.id).eq("user_id", ctx.userId).select().single(),
    "update routine",
  );
  const what =
    input.enabled === false ? "Paused" : input.enabled === true && !before.enabled ? "Resumed" : "Updated";
  await logAction(ctx, {
    tool: "update_routine",
    entityType: "routine",
    entityId: before.id,
    before,
    after,
    summary: `${what} routine "${after.name}"`,
  });
  return after;
}

export async function removeRoutine(ctx: Ctx, idOrName: string) {
  const before = await findRoutine(ctx, idOrName);
  const after = must(
    await ctx.db
      .from("routines")
      .update({ deleted_at: ctx.now.toISOString() })
      .eq("id", before.id)
      .eq("user_id", ctx.userId)
      .select()
      .single(),
    "remove routine",
  );
  await logAction(ctx, {
    tool: "remove_routine",
    entityType: "routine",
    entityId: before.id,
    before,
    after,
    summary: `Removed routine "${before.name}" from Hyperpolymath`,
  });
  return { removed: before.name };
}

/**
 * Check in at the start of a run. Returns enabled=false when the owner paused
 * the routine in the app; the bot must then stop.
 */
export async function startRun(ctx: Ctx, idOrName: string) {
  const routine = await findRoutine(ctx, idOrName);
  if (!routine.enabled) {
    await ctx.db.from("routine_runs").insert({
      user_id: ctx.userId,
      routine_id: routine.id,
      status: "skipped",
      finished_at: ctx.now.toISOString(),
      summary: "Paused in Hyperpolymath",
    });
    await ctx.db
      .from("routines")
      .update({ last_run_at: ctx.now.toISOString(), last_status: "skipped", last_summary: "Paused in Hyperpolymath" })
      .eq("id", routine.id);
    return {
      enabled: false,
      routine: routine.name,
      instructions: "This routine is paused in Hyperpolymath. Stop now without doing the work.",
    };
  }
  const run = must(
    await ctx.db
      .from("routine_runs")
      .insert({ user_id: ctx.userId, routine_id: routine.id })
      .select("id")
      .single(),
    "start run",
  );
  let widget: { id: string; title: string; kind: string } | null = null;
  if (routine.widget_id) {
    const { data } = await ctx.db.from("widgets").select("id, title, kind").eq("id", routine.widget_id).maybeSingle();
    widget = data;
  }
  return {
    enabled: true,
    routine: routine.name,
    run_id: run.id,
    widget,
    instructions: widget
      ? `Do the work, publish_widget to "${widget.title}", then finish_routine_run with a one-line summary.`
      : "Do the work, then finish_routine_run with a one-line summary.",
  };
}

export async function finishRun(
  ctx: Ctx,
  runId: string,
  result: { status?: "ok" | "error"; summary?: string | null },
) {
  const run = must(
    await ctx.db.from("routine_runs").select().eq("id", runId).eq("user_id", ctx.userId).maybeSingle(),
    `run ${runId}`,
  );
  const status = result.status ?? "ok";
  const summary = result.summary?.slice(0, 500) ?? null;
  await ctx.db
    .from("routine_runs")
    .update({ status, summary, finished_at: ctx.now.toISOString() })
    .eq("id", run.id);
  const routine = await getRoutine(ctx, run.routine_id);
  await ctx.db
    .from("routines")
    .update({
      last_run_at: ctx.now.toISOString(),
      last_status: status,
      last_summary: summary,
      run_count: routine.run_count + 1,
    })
    .eq("id", routine.id);
  return { routine: routine.name, status };
}

export async function listRuns(ctx: Ctx, routineId: string, limit = 20) {
  return must(
    await ctx.db
      .from("routine_runs")
      .select()
      .eq("user_id", ctx.userId)
      .eq("routine_id", routineId)
      .order("started_at", { ascending: false })
      .limit(limit),
    "routine runs",
  );
}
