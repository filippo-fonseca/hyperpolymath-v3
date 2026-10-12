"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { hasSupabaseEnv, isOwnerEmail } from "@/lib/supabase/env";
import { EMAIL_RE, isRateLimited, retryAfterSeconds } from "@/lib/auth-errors";

export type MagicLinkState =
  | { status: "idle"; email?: string }
  | { status: "sent"; email: string; sentAt: number }
  | { status: "error"; message: string; email?: string; field?: "email" }
  | { status: "rate_limited"; email: string; retryAfter: number; at: number };

/** Fixed site origin for auth redirects. Never derived from request headers. */
function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

export async function sendMagicLink(_prev: MagicLinkState, form: FormData): Promise<MagicLinkState> {
  const email = String(form.get("email") ?? "").trim();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { status: "error", field: "email", email, message: "That doesn't look like an email address." };
  }
  if (!hasSupabaseEnv() || !process.env.OWNER_EMAIL) {
    return { status: "error", email, message: "Sign-in isn't configured yet. Set the Supabase env vars and OWNER_EMAIL." };
  }
  const sent: MagicLinkState = { status: "sent", email, sentAt: Date.now() };
  // Same response either way so the form never reveals who the owner is.
  if (!isOwnerEmail(email)) return sent;
  try {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl()}/auth/callback`, shouldCreateUser: true },
    });
    if (!error) return sent;
    if (isRateLimited(error)) {
      return { status: "rate_limited", email, retryAfter: retryAfterSeconds(error), at: Date.now() };
    }
    console.error("[auth] signInWithOtp failed", error.code ?? error.name, error.status);
  } catch (e) {
    console.error("[auth] signInWithOtp threw", e instanceof Error ? e.name : e);
  }
  return { status: "error", email, message: "Couldn't send a sign-in link right now. Try again in a minute." };
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
