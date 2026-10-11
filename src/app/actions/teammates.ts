"use server";

import { z } from "zod";
import { escapeLike, AppError } from "@/server/ctx";
import { resolveBotActor, updateBot } from "@/server/bots";
import { listRuns, registerRoutine, removeRoutine, updateRoutine } from "@/server/routines";
import { asUser, readAsUser } from "./run";

// Teammates view: bots and the Grok Bot routines they registered. Every write
// goes through the service layer, so bots see it on their next MCP call and
// the activity log can revert it.

const id = z.string().uuid();
const botName = z.string().trim().min(1).max(60);
const SHAPES = ["blob", "squircle", "hex", "pebble", "tablet", "wedge"] as const;
const COLORS = ["blue", "green", "orange", "magenta", "violet", "cyan", "red", "brown"] as const;

const routineFields = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable(),
  schedule: z.string().trim().max(200).nullable(),
  widget: id.nullable(),
  enabled: z.boolean(),
});

/** Blank text fields mean "clear it". */
function clean<T extends Record<string, unknown>>(v: T): T {
  const out: Record<string, unknown> = { ...v };
  for (const k of ["description", "schedule"]) if (out[k] === "") out[k] = null;
  return out as T;
}

export async function listRunsAction(routineId: string) {
  return readAsUser((ctx) => listRuns(ctx, id.parse(routineId), 30));
}

export async function updateRoutineAction(
  routineId: string,
  patch: Partial<{ name: string; description: string | null; schedule: string | null; widget: string | null; enabled: boolean }>,
) {
  return asUser((ctx) => updateRoutine(ctx, id.parse(routineId), clean(routineFields.partial().parse(patch))));
}

export async function registerRoutineAction(input: {
  bot: string;
  name: string;
  description?: string | null;
  schedule?: string | null;
  widget?: string | null;
}) {
  return asUser(async (ctx) => {
    const v = clean(routineFields.omit({ enabled: true }).partial({ description: true, schedule: true, widget: true }).parse(input));
    return registerRoutine(ctx, { ...v, bot: botName.parse(input.bot), enabled: true });
  });
}

export async function removeRoutineAction(routineId: string) {
  return asUser((ctx) => removeRoutine(ctx, id.parse(routineId)));
}

export async function updateBotAction(
  name: string,
  patch: Partial<{ role: string; description: string; parent: string | null; avatar_shape: string; avatar_color: string }>,
) {
  return asUser((ctx) => {
    const p = z
      .object({
        role: z.string().trim().max(120),
        description: z.string().trim().max(2000),
        parent: botName.nullable(),
        avatar_shape: z.enum(SHAPES),
        avatar_color: z.enum(COLORS),
      })
      .partial()
      .parse(patch);
    return updateBot(ctx, botName.parse(name), p);
  });
}

/**
 * Add a teammate by hand: registers the bot the same way a bot's first MCP
 * call does (filed under Kiwi), then sets its role. Adding an archived name
 * brings it back.
 */
export async function addTeammateAction(input: { name: string; role?: string }) {
  return asUser(async (ctx) => {
    const name = botName.parse(input.name);
    const role = z.string().trim().max(120).optional().parse(input.role) ?? "";
    const { data: existing } = await ctx.db
      .from("bots")
      .select("id, archived_at")
      .eq("user_id", ctx.userId)
      .ilike("name", escapeLike(name))
      .maybeSingle();
    if (existing && !existing.archived_at) throw new AppError(`${name} is already a teammate.`, "conflict");
    const actor = await resolveBotActor(ctx.db, ctx.userId, name);
    if (actor.kind !== "bot") throw new AppError("Couldn't add that teammate.");
    // Registering stamps last_seen_at; a bot added by hand hasn't actually been seen yet.
    if (!existing) {
      await ctx.db.from("bots").update({ last_seen_at: null }).eq("id", actor.botId).eq("user_id", ctx.userId);
    }
    return updateBot(ctx, actor.name, role ? { role } : {});
  });
}
