import "server-only";
import { redirect } from "next/navigation";
import { makeCtx, type Actor, type Ctx } from "@/server/ctx";
import { supabaseServer } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/supabase/env";

export const USER_ACTOR: Actor = { kind: "user", name: "you" };

/** The signed-in owner's id, or null. Never trusts anything but the session. */
export async function currentUserId(): Promise<string | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  if (!isOwnerEmail(email)) return null;
  return data.claims.sub;
}

/** Resolve the owner's id or redirect to /login. */
export async function requireUser(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) redirect("/login");
  return userId;
}

/** Service context for writes made by you in the UI. */
export async function userCtx(): Promise<Ctx> {
  return makeCtx(await requireUser(), USER_ACTOR);
}
