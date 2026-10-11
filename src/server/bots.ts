import "server-only";
import { AppError, must, type Actor, type Ctx, type DB } from "./ctx";
import { logAction } from "./log";

const SHAPES = ["blob", "squircle", "hex", "pebble", "tablet", "wedge"];
const COLORS = ["blue", "green", "orange", "magenta", "violet", "cyan", "red", "brown"];

function pick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return arr[Math.abs(h) % arr.length];
}

/**
 * Resolve a bot by name for MCP attribution, registering it on first sight.
 * A bot named Kiwi becomes the coordinator (if there isn't one yet); every
 * other new bot is filed under the coordinator. Archived bots come back when
 * they act again.
 */
export async function resolveBotActor(db: DB, userId: string, rawName: string): Promise<Actor> {
  const name = rawName.trim().slice(0, 60);
  if (!name) throw new AppError("`bot` is required: pass your bot name, e.g. \"Kiwi\".");
  const { data: existing } = await db
    .from("bots")
    .select("id, name")
    .eq("user_id", userId)
    .ilike("name", name.replace(/[%_]/g, "\\$&"))
    .maybeSingle();
  if (existing) {
    await db.from("bots").update({ last_seen_at: new Date().toISOString(), archived_at: null }).eq("id", existing.id);
    return { kind: "bot", name: existing.name, botId: existing.id };
  }
  const { count } = await db
    .from("bots")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_coordinator", true);
  const coordinator = !count && /^kiwi$/i.test(name);
  const { data: kiwi } = coordinator
    ? { data: null }
    : await db.from("bots").select("id").eq("user_id", userId).eq("is_coordinator", true).limit(1).maybeSingle();
  const bot = must(
    await db
      .from("bots")
      .insert({
        user_id: userId,
        name,
        is_coordinator: coordinator,
        parent_id: kiwi?.id ?? null,
        avatar_shape: pick(SHAPES, name),
        avatar_color: pick(COLORS, name + "c"),
        last_seen_at: new Date().toISOString(),
      })
      .select()
      .single(),
    "register bot",
  );
  return { kind: "bot", name: bot.name, botId: bot.id };
}

export async function listBots(ctx: Ctx) {
  return must(
    await ctx.db
      .from("bots")
      .select()
      .eq("user_id", ctx.userId)
      .is("archived_at", null)
      .order("is_coordinator", { ascending: false })
      .order("name"),
    "list bots",
  );
}

export async function updateBot(
  ctx: Ctx,
  name: string,
  patch: { role?: string; description?: string; parent?: string | null; avatar_shape?: string; avatar_color?: string },
) {
  const before = must(
    await ctx.db.from("bots").select().eq("user_id", ctx.userId).ilike("name", name).maybeSingle(),
    `bot "${name}"`,
  );
  let parent_id = before.parent_id;
  if (patch.parent !== undefined) {
    if (patch.parent === null) parent_id = null;
    else {
      const p = must(
        await ctx.db.from("bots").select("id").eq("user_id", ctx.userId).ilike("name", patch.parent).maybeSingle(),
        `parent bot "${patch.parent}"`,
      );
      parent_id = p.id;
    }
  }
  const after = must(
    await ctx.db
      .from("bots")
      .update({
        role: patch.role ?? before.role,
        description: patch.description ?? before.description,
        avatar_shape: patch.avatar_shape ?? before.avatar_shape,
        avatar_color: patch.avatar_color ?? before.avatar_color,
        parent_id,
      })
      .eq("id", before.id)
      .select()
      .single(),
    "update bot",
  );
  await logAction(ctx, {
    tool: "update_bot",
    entityType: "bot",
    entityId: after.id,
    before,
    after,
    summary: `Updated teammate ${after.name}`,
  });
  return after;
}

/** Retire a bot from the teammates view. Its history stays; acting again restores it. */
export async function archiveBot(ctx: Ctx, name: string) {
  const before = must(
    await ctx.db.from("bots").select().eq("user_id", ctx.userId).ilike("name", name).is("archived_at", null).maybeSingle(),
    `bot "${name}"`,
  );
  if (before.is_coordinator) throw new AppError("The coordinator can't be archived.");
  const after = must(
    await ctx.db.from("bots").update({ archived_at: ctx.now.toISOString() }).eq("id", before.id).select().single(),
    "archive bot",
  );
  await logAction(ctx, {
    tool: "archive_bot",
    entityType: "bot",
    entityId: before.id,
    before,
    after,
    summary: `Archived teammate ${before.name}`,
  });
  return { archived: before.name };
}
