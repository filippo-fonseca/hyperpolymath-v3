"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { adminDb } from "@/server/ctx";
import { createCode, listGrants, revokeGrant } from "@/server/oauth";
import { checkAuthorize, errorRedirect, pickParams } from "@/server/oauth-authorize";
import { originFrom } from "@/server/oauth-http";
import { currentUserId } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { withParams } from "@/lib/oauth";
import { readAsUser, asUser } from "./run";

// The consent screen's buttons, and connected apps in Settings. Next checks
// the Origin of every Server Action call, so a third-party page can't submit
// the consent form; the page also refuses to be framed (next.config.ts).

export type ConsentResult = { ok: true; redirect: string } | { ok: false; error: string };

async function issuer() {
  return originFrom(await headers());
}

/** Approve: mint a single-use code and hand back the URL to return to the app. */
export async function approveAuthorization(form: FormData): Promise<ConsentResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Your session ended. Sign in again, then reconnect from the app." };
  const iss = await issuer();
  const check = await checkAuthorize(adminDb(), pickParams(form), iss);
  if (check.kind === "fatal") return { ok: false, error: check.detail };
  if (check.kind === "redirect") return { ok: true, redirect: check.url };
  try {
    const code = await createCode(adminDb(), {
      userId,
      client: check.client,
      redirectUri: check.redirectUri,
      codeChallenge: check.codeChallenge,
      scope: check.scope,
      resource: check.resource,
    });
    return { ok: true, redirect: withParams(check.redirectUri, { code, state: check.state, iss }) };
  } catch (e) {
    console.error("[oauth] approve failed", e);
    return { ok: false, error: "Couldn't finish connecting. Try again." };
  }
}

/** Deny: send the app an access_denied error so it can stop waiting. */
export async function denyAuthorization(form: FormData): Promise<ConsentResult> {
  const iss = await issuer();
  const check = await checkAuthorize(adminDb(), pickParams(form), iss);
  if (check.kind === "fatal") return { ok: false, error: check.detail };
  if (check.kind === "redirect") return { ok: true, redirect: check.url };
  return { ok: true, redirect: errorRedirect(check.redirectUri, iss, check.state, "access_denied", "The account owner declined.") };
}

/** "Not you?": sign out and come back to this same consent screen. */
export async function switchAccount(nextPath: string) {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  const next = nextPath.startsWith("/oauth/authorize?") ? nextPath : "/";
  return `/login?next=${encodeURIComponent(next)}`;
}

export async function listConnectedAppsAction() {
  return readAsUser((ctx) => listGrants(ctx.db, ctx.userId));
}

export async function disconnectAppAction(grantId: string) {
  return asUser(async (ctx) => {
    await revokeGrant(ctx.db, ctx.userId, z.string().uuid().parse(grantId));
    return true;
  }, { write: false });
}
