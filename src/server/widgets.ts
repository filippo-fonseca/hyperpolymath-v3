import "server-only";
import { AppError, asJson, must, type Ctx, type DB, type Row, type Update, escapeLike } from "./ctx";
import { logAction } from "./log";
import { recordPublish } from "./routines";
import { loadInsightsRaw } from "./insights";
import { defaultSizeFor, isCustomKind, normalizeWidgetIcon, validatePayload, type CustomKind, type WidgetSize } from "@/lib/widgets";
import { daysNeeded, resolveSource, sourceSchema, SOURCE_INFO, type WidgetSource } from "@/lib/widget-sources";

export type Widget = Row<"widgets">;

const DEFAULT_LAYOUT: { kind: Widget["kind"]; title: string; size: WidgetSize }[] = [
  { kind: "tasks", title: "Today", size: "l" },
  { kind: "calendar", title: "Calendar", size: "l" },
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

export async function listWidgets(ctx: Ctx, opts: { resolve?: boolean } = {}) {
  const rows = must(
    await ctx.db
      .from("widgets")
      .select("*, owner:bots(id, name, avatar_shape, avatar_color)")
      .eq("user_id", ctx.userId)
      .is("deleted_at", null)
      .order("page")
      .order("position"),
    "list widgets",
  );
  return opts.resolve === false ? rows : resolveLive(ctx, rows);
}

/** A widget's live source, when it has a valid one for its kind. */
export function liveSource(w: Pick<Widget, "kind" | "source">): WidgetSource | null {
  if (!w.source || !isCustomKind(w.kind)) return null;
  const parsed = sourceSchema.safeParse(w.source);
  if (!parsed.success || !SOURCE_INFO[parsed.data.id].kinds.includes(w.kind)) return null;
  return parsed.data;
}

/**
 * Fill live widgets from the owner's data: one bounded read for all of them,
 * and only when the dashboard has any. They always count as just published.
 */
async function resolveLive<W extends Widget>(ctx: Ctx, rows: W[]): Promise<W[]> {
  const live = rows.map((w) => liveSource(w));
  const sources = live.filter((s): s is WidgetSource => !!s);
  if (!sources.length) return rows;
  try {
    const raw = await loadInsightsRaw(ctx, daysNeeded(sources));
    const now = ctx.now.toISOString();
    return rows.map((w, i) => {
      const src = live[i];
      return src ? { ...w, payload: asJson(resolveSource(raw, src, w.kind as CustomKind)), published_at: now } : w;
    });
  } catch (e) {
    // A failed read leaves live widgets in their waiting state rather than breaking the dashboard.
    console.error("[widgets] live sources", e);
    return rows;
  }
}

function parseSource(kind: CustomKind, source: unknown): WidgetSource {
  const parsed = sourceSchema.safeParse(source);
  if (!parsed.success) throw new AppError(`Invalid source: ${parsed.error.issues.map((i) => `${i.path.join(".") || "source"}: ${i.message}`).join("; ")}. Call widget_kinds for the list.`);
  const info = SOURCE_INFO[parsed.data.id];
  if (!info.kinds.includes(kind)) throw new AppError(`Source "${parsed.data.id}" draws as ${info.kinds.join(", ")}, not ${kind}.`);
  return parsed.data;
}

function parsePayload(kind: CustomKind, payload: unknown) {
  const r = validatePayload(kind, payload);
  if (!r.ok) throw new AppError(`Payload doesn't match kind "${kind}": ${r.error}. Call widget_kinds with kind "${kind}" for its schema and an example.`);
  return r.data;
}

function cleanBrief(brief: string | null | undefined) {
  if (brief === undefined) return undefined;
  const t = brief?.trim() ?? "";
  if (t.length > 2000) throw new AppError("Keep the brief under 2000 characters.");
  return t || null;
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
    /** Live widgets: the app fills the payload from this source. */
    source?: unknown;
    /** What the owner wants in it, in their words, for the owner bot to follow. */
    brief?: string | null;
    /** The owner can hand a new widget to a bot; a bot always owns what it creates. */
    owner_bot_id?: string | null;
  },
) {
  if (!isCustomKind(input.kind)) throw new AppError(`Only custom widgets can be created (${input.kind} is built in).`);
  const title = input.title.trim();
  if (!title) throw new AppError("Widget title can't be empty.");
  if (input.source != null && input.payload !== undefined) throw new AppError("A widget takes a payload or a live source, not both.");
  const source = input.source != null ? parseSource(input.kind, input.source) : null;
  const payload = input.payload === undefined ? null : parsePayload(input.kind, input.payload);
  const brief = cleanBrief(input.brief) ?? null;
  let owner = ctx.actor.kind === "bot" ? ctx.actor.botId : null;
  if (ctx.actor.kind !== "bot" && input.owner_bot_id) {
    must(await ctx.db.from("bots").select("id").eq("id", input.owner_bot_id).eq("user_id", ctx.userId).maybeSingle(), "owner bot");
    owner = input.owner_bot_id;
  }
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
        size: input.size ?? defaultSizeFor(input.kind),
        stale_after_hours: input.stale_after_hours ?? null,
        icon: icon(input.icon),
        owner_bot_id: owner,
        payload: asJson(payload ?? {}),
        source: source ? asJson(source) : null,
        brief,
        published_at: payload || source ? ctx.now.toISOString() : null,
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
    summary: `Added ${source ? "live " : ""}widget "${title}" (${input.kind})`,
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
  patch: {
    title?: string;
    icon?: string | null;
    stale_after_hours?: number | null;
    owner_bot_id?: string | null;
    brief?: string | null;
    /** Change a live widget's source, and optionally how it draws (kind). null turns it back into a published widget. */
    source?: unknown;
    kind?: CustomKind;
  },
) {
  const before = await findWidget(ctx, idOrTitle);
  const custom = isCustomKind(before.kind);
  if (!custom && (patch.stale_after_hours !== undefined || patch.owner_bot_id !== undefined || patch.brief !== undefined || patch.source !== undefined || patch.kind !== undefined)) {
    throw new AppError("Built-in widgets show live app data, so they have no owner, brief, source or staleness window.");
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
  if (patch.brief !== undefined) values.brief = cleanBrief(patch.brief) ?? null;
  if (patch.kind !== undefined || patch.source !== undefined) {
    const kind = patch.kind ?? (before.kind as CustomKind);
    if (!isCustomKind(kind)) throw new AppError(`"${kind}" isn't a custom widget kind.`);
    const source = patch.source !== undefined ? patch.source : before.source;
    if (source != null) {
      values.source = asJson(parseSource(kind, source));
      values.published_at = ctx.now.toISOString();
    } else if (patch.source === null && before.source) {
      // No longer live: it waits for a publish again.
      values.source = null;
      values.payload = asJson({});
      values.published_at = null;
    } else if (kind !== before.kind) {
      throw new AppError("Changing a published widget's kind needs new content: use publish_widget with kind and payload.");
    }
    values.kind = kind;
  }
  const after = must(
    await ctx.db.from("widgets").update(values).eq("id", before.id).eq("user_id", ctx.userId).select().single(),
    "update widget",
  );
  const what = [
    values.title !== undefined && values.title !== before.title ? `renamed to "${after.title}"` : null,
    values.icon !== undefined && values.icon !== before.icon ? "icon changed" : null,
    values.owner_bot_id !== undefined && values.owner_bot_id !== before.owner_bot_id ? "owner changed" : null,
    values.stale_after_hours !== undefined && values.stale_after_hours !== before.stale_after_hours ? "staleness window changed" : null,
    values.brief !== undefined && values.brief !== before.brief ? "brief changed" : null,
    values.kind !== undefined && values.kind !== before.kind ? `now a ${values.kind}` : null,
    values.source !== undefined && JSON.stringify(values.source) !== JSON.stringify(before.source) ? (values.source ? "source changed" : "no longer live") : null,
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
export async function publishWidget(ctx: Ctx, idOrTitle: string, payload: unknown, kind?: CustomKind) {
  const before = await findWidget(ctx, idOrTitle);
  if (!isCustomKind(before.kind)) throw new AppError(`"${before.title}" is a built-in widget; it shows live app data.`);
  if (before.source) throw new AppError(`"${before.title}" is live: the app fills it from the owner's own data. Change it with update_widget (source, kind).`);
  if (kind !== undefined && !isCustomKind(kind)) throw new AppError(`"${kind}" isn't a custom widget kind.`);
  // A bot may redraw a widget as a better-suited kind, as long as the payload matches it.
  const nextKind = kind ?? before.kind;
  const data = parsePayload(nextKind, payload);
  const parsed = { data };
  // Same content as last time: refresh the timestamp (it isn't stale) but
  // keep history and the activity log quiet.
  if (nextKind === before.kind && before.published_at && stableJson(before.payload) === stableJson(parsed.data)) {
    await ctx.db.from("widgets").update({ published_at: ctx.now.toISOString() }).eq("id", before.id).eq("user_id", ctx.userId);
    await recordPublish(ctx, before, false);
    return { widget: before.title, published_at: ctx.now.toISOString(), changed: false };
  }
  const after = must(
    await ctx.db
      .from("widgets")
      .update({ kind: nextKind, payload: asJson(parsed.data), published_at: ctx.now.toISOString() })
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
    summary: nextKind === before.kind ? `Published to "${before.title}"` : `Published to "${before.title}" as a ${nextKind}`,
  });
  await recordPublish(ctx, before, true);
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
