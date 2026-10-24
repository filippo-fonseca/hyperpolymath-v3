"use server";

import { z } from "zod";
import { listTokens, mintToken, revokeToken } from "@/server/tokens";
import { setTaskView, setTimezone } from "@/server/settings";
import { taskViewSchema } from "@/lib/task-view";
import { clearRelay, setRelay } from "@/server/relay";
import { asUser, readAsUser } from "./run";

export async function listTokensAction() {
  return readAsUser((ctx) => listTokens(ctx.db, ctx.userId));
}

/** Returns the plaintext token exactly once. */
export async function mintTokenAction(name: string) {
  return asUser((ctx) => mintToken(ctx.db, ctx.userId, z.string().max(60).parse(name)), { write: false });
}

export async function revokeTokenAction(tokenId: string) {
  return asUser(async (ctx) => {
    await revokeToken(ctx.db, ctx.userId, z.string().uuid().parse(tokenId));
    return true;
  }, { write: false });
}

export async function setTimezoneAction(tz: string) {
  return asUser((ctx) => setTimezone(ctx, z.string().min(1).max(80).parse(tz)));
}

/** Save how a task tab sorts, groups and filters. The client already shows it, so no refresh. */
export async function setTaskViewAction(input: unknown) {
  return asUser(async (ctx) => {
    const { view, prefs } = taskViewSchema.parse(input);
    return setTaskView(ctx, view, prefs);
  }, { write: false });
}

/** Save this account's Reminder relay webhook. The key is never sent back. */
export async function setRelayAction(input: { url: string; token: string }) {
  const schema = z.object({ url: z.string().min(1).max(500), token: z.string().min(1).max(500) });
  return asUser((ctx) => setRelay(ctx, schema.parse(input)), { write: false });
}

export async function clearRelayAction() {
  return asUser((ctx) => clearRelay(ctx), { write: false });
}
