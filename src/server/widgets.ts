import "server-only";
import { AppError, asJson, must, type Ctx, type DB, type Row, type Update, escapeLike } from "./ctx";
import { logAction } from "./log";
import { isCustomKind, normalizeWidgetIcon, payloadSchemas, type CustomKind, type WidgetSize } from "@/lib/widgets";

export type Widget = Row<"widgets">;

const DEFAULT_LAYOUT: { kind: Widget["kind"]; title: string; size: WidgetSize }[] = [
  { kind: "tasks", title: "Today", size: "l" },
  { kind: "calendar", title: "Calendar", size: "m" },
  { kind: "habits", title: "Habits", size: "m" },
  { kind: "capture", title: "Capture", size: "m" },
  { kind: "kiwi", title: "Kiwi", size: "m" },
  { kind: "projects", title: "Projects", size: "m" },
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
  input: {
    kind: CustomKind;
    title: string;
    size?: WidgetSize;
    stale_after_hours?: number | null;
    payload?: unknown;
    icon?: string | null;
  },
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
        icon: icon(input.icon),
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

function icon(raw: string | null | undefined) {
  try {
    return normalizeWidgetIcon(raw);
  } catch (e) {
    throw new AppError((e as Error).message);
  }
}

/**
 * Edit a widget's title, icon, staleness window or owner bot. Size and page
 * go through saveLayout. Built-in widgets only take a title and icon.
 */
export async function updateWidget(
  ctx: Ctx,
  idOrTitle: string,
  patch: { title?: string; icon?: string | null; stale_after_hours?: number | null; owner_bot_id?: string | null },
) {
  const before = await findWidget(ctx, idOrTitle);
  const custom = isCustomKind(before.kind);
  if (!custom && (patch.stale_after_hours !== undefined || patch.owner_bot_id !== undefined)) {
    throw new AppError("Built-in widgets show live app data, so they have no owner or staleness window.");
  }
  if (patch.owner_bot_id) {
    must(
      await ctx.db.from("bots").select("id").eq("id", patch.owner_bot_id).eq("user_id", ctx.userId).maybeSingle(),
      "owner bot",
    );
  }
  const values: Update<"widgets"> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) throw new AppError("Widget title can't be empty.");
    values.title = t;
  }
  if (patch.icon !== undefined) values.icon = icon(patch.icon);
  if (patch.stale_after_hours !== undefined) values.stale_after_hours = patch.stale_after_hours;
  if (patch.owner_bot_id !== undefined) values.owner_bot_id = patch.owner_bot_id;
  const after = must(
    await ctx.db.from("widgets").update(values).eq("id", before.id).eq("user_id", ctx.userId).select().single(),
    "update widget",
  );
  const what = [
    values.title !== undefined && values.title !== before.title ? `renamed to "${after.title}"` : null,
    values.icon !== undefined && values.icon !== before.icon ? "icon changed" : null,
    values.owner_bot_id !== undefined && values.owner_bot_id !== before.owner_bot_id ? "owner changed" : null,
    values.stale_after_hours !== undefined && values.stale_after_hours !== before.stale_after_hours ? "staleness window changed" : null,
  ].filter(Boolean);
  await logAction(ctx, {
    tool: "update_widget",
    entityType: "widget",
    entityId: before.id,
    before,
    after,
    summary: `Updated widget "${before.title}"${what.length ? ` (${what.join(", ")})` : ""}`,
  });
  return after;
}

/** JSON with sorted keys, so equal payloads compare equal regardless of key order. */
function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
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
  // Same content as last time: refresh the timestamp (it isn't stale) but
  // keep history and the activity log quiet.
  if (before.published_at && stableJson(before.payload) === stableJson(parsed.data)) {
    await ctx.db.from("widgets").update({ published_at: ctx.now.toISOString() }).eq("id", before.id).eq("user_id", ctx.userId);
    return { widget: before.title, published_at: ctx.now.toISOString(), changed: false };
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
  return { widget: after.title, published_at: after.published_at, changed: true };
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
