"use server";

import { z } from "zod";
import { listTokens, mintToken, revokeToken } from "@/server/tokens";
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
    return null;
  }, { write: false });
}
