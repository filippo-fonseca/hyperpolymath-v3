"use server";

import { z } from "zod";
import { listActions, revertAction } from "@/server/log";
import { archiveBot } from "@/server/bots";
import { asUser, readAsUser } from "./run";

const id = z.string().uuid();

export async function loadActionsAction(opts: { botId?: string | null; before?: string | null; limit?: number }) {
  return readAsUser((ctx) =>
    listActions(ctx, {
      botId: id.nullable().optional().parse(opts.botId) ?? undefined,
      before: z.string().max(40).nullable().optional().parse(opts.before) ?? undefined,
      limit: z.number().int().min(1).max(200).optional().parse(opts.limit) ?? 60,
    }),
  );
}

/**
 * Revert an action. Returns the id of the new "revert" action so the UI can
 * offer Undo (which reverts that one in turn).
 */
export async function revertActionAction(actionId: string, force = false) {
  return asUser(async (ctx) => {
    const res = await revertAction(ctx, id.parse(actionId), !!force);
    const recent = await listActions(ctx, { limit: 10 });
    const undo = recent.find((a) => a.tool === "revert_action" && a.entity_id === res.entity_id);
    return { ...res, undo_id: undo?.id ?? null };
  });
}

export async function archiveBotAction(name: string) {
  return asUser((ctx) => archiveBot(ctx, z.string().min(1).max(60).parse(name)));
}
