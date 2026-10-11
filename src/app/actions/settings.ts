"use server";

import { z } from "zod";
import { listTokens, mintToken, revokeToken } from "@/server/tokens";
import { setTimezone } from "@/server/settings";
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
