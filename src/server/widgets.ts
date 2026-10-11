import "server-only";
import { AppError, asJson, must, type Ctx, type DB, type Row, escapeLike } from "./ctx";
import { logAction } from "./log";
import { isCustomKind, payloadSchemas, type CustomKind, type WidgetSize } from "@/lib/widgets";

export type Widget = Row<"widgets">;

const DEFAULT_LAYOUT: { kind: Widget["kind"]; title: string; size: WidgetSize }[] = [
  { kind: "tasks", title: "Today", size: "l" },
  { kind: "calendar", title: "Calendar", size: "m" },
  { kind: "habits", title: "Habits", size: "m" },
  { kind: "capture", title: "Capture", size: "m" },
  { kind: "kiwi", title: "Kiwi", size: "m" },
];

/** Seed the fixed widgets the first time a user opens the dashboard. */
export async function ensureDefaultWidgets(db: DB, userId: string) {
  const { count } = await db.from("widgets").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (count) return;
  await db.from("widgets").insert(
    DEFAULT_LAYOUT.map((w, i) => ({ user_id: userId, kind: w.kind, title: w.title, size: w.size, page: 0, position: i })),
  );
}

export async function listWidgets(ctx: Ctx) {
  return must(
    await ctx.db
      .from("widgets")
      .select("*, owner:bots(id, name, avatar_shape, avatar_color)")
      .eq("user_id", ctx.userId)
      .is("deleted_at", null)
      .order("page")
      .order("position"),
    "list widgets",
  );
}

async function findWidget(ctx: Ctx, idOrTitle: string): Promise<Widget> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrTitle);
  const q = ctx.db.from("widgets").select().eq("user_id", ctx.userId).is("deleted_at", null);
  const { data } = isUuid
    ? await q.eq("id", idOrTitle).maybeSingle()
    : await q.ilike("title", escapeLike(idOrTitle)).limit(1).maybeSingle();
  if (!data) throw new AppError(`No widget "${idOrTitle}". Use list_widgets.`, "not_found");
  return data;
}

export async function createWidget(
  ctx: Ctx,
  input: { kind: CustomKind; title: string; size?: WidgetSize; stale_after_hours?: number | null; payload?: unknown },
) {
  if (!isCustomKind(input.kind)) throw new AppError(`Bots can only create custom widgets (${input.kind} is fixed).`);
  const title = input.title.trim();
  if (!title) throw new AppError("Widget title can't be empty.");
  const payload = input.payload === undefined ? null : payloadSchemas[input.kind].parse(input.payload);
  const { data: last } = await ctx.db
    .from("widgets")
    .select("page, position")
    .eq("user_id", ctx.userId)
    .is("deleted_at", null)
    .order("page", { ascending: false })
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const widget = must(
    await ctx.db
      .from("widgets")
      .insert({
        user_id: ctx.userId,
        kind: input.kind,
        title,
        size: input.size ?? "m",
        stale_after_hours: input.stale_after_hours ?? null,
        owner_bot_id: ctx.actor.kind === "bot" ? ctx.actor.botId : null,
        payload: asJson(payload ?? {}),
        published_at: payload ? ctx.now.toISOString() : null,
        page: last?.page ?? 0,
        position: (last?.position ?? 0) + 1,
      })
      .select()
      .single(),
    "create widget",
  );
  if (payload) await snapshot(ctx, widget.id, payload);
  await logAction(ctx, {
    tool: "create_widget",
    entityType: "widget",
    entityId: widget.id,
    before: null,
    after: widget,
    summary: `Added widget "${title}" (${input.kind})`,
  });
  return widget;
}

async function snapshot(ctx: Ctx, widgetId: string, payload: unknown) {
  await ctx.db.from("widget_snapshots").insert({
    user_id: ctx.userId,
    widget_id: widgetId,
    payload: asJson(payload),
    bot_id: ctx.actor.kind === "bot" ? ctx.actor.botId : null,
  });
}

/** Replace a custom widget's content. Keeps a snapshot for history. */
export async function publishWidget(ctx: Ctx, idOrTitle: string, payload: unknown) {
  const before = await findWidget(ctx, idOrTitle);
  if (!isCustomKind(before.kind)) throw new AppError(`"${before.title}" is a fixed widget; it shows live app data.`);
  const parsed = payloadSchemas[before.kind].safeParse(payload);
  if (!parsed.success) {
    throw new AppError(`Payload doesn't match kind "${before.kind}": ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  const after = must(
    await ctx.db
      .from("widgets")
      .update({ payload: asJson(parsed.data), published_at: ctx.now.toISOString() })
      .eq("id", before.id)
      .select()
      .single(),
    "publish widget",
  );
  await snapshot(ctx, before.id, parsed.data);
  await logAction(ctx, {
    tool: "publish_widget",
    entityType: "widget",
    entityId: before.id,
    before,
    after,
    summary: `Published to "${before.title}"`,
  });
  return { widget: after.title, published_at: after.published_at };
}

export async function removeWidget(ctx: Ctx, idOrTitle: string) {
  const before = await findWidget(ctx, idOrTitle);
  if (!isCustomKind(before.kind)) throw new AppError(`"${before.title}" is a fixed widget and can't be removed.`);
  const after = must(
    await ctx.db.from("widgets").update({ deleted_at: ctx.now.toISOString() }).eq("id", before.id).select().single(),
    "remove widget",
  );
  await logAction(ctx, {
    tool: "remove_widget",
    entityType: "widget",
    entityId: before.id,
    before,
    after,
    summary: `Removed widget "${before.title}"`,
  });
  return { removed: before.title };
}

export async function widgetHistory(ctx: Ctx, widgetId: string, limit = 20) {
  return must(
    await ctx.db
      .from("widget_snapshots")
      .select("id, payload, created_at, bot:bots(name)")
      .eq("user_id", ctx.userId)
      .eq("widget_id", widgetId)
      .order("created_at", { ascending: false })
      .limit(limit),
    "widget history",
  );
}

/** Layout changes from the dashboard (drag, resize). Not logged: they're noise. */
export async function saveLayout(
  ctx: Ctx,
  items: { id: string; page: number; position: number; size?: WidgetSize }[],
) {
  await Promise.all(
    items.map((it) =>
      ctx.db
        .from("widgets")
        .update({ page: it.page, position: it.position, ...(it.size ? { size: it.size } : {}) })
        .eq("id", it.id)
        .eq("user_id", ctx.userId),
    ),
  );
}
