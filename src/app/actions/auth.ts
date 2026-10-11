"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { hasSupabaseEnv, isOwnerEmail } from "@/lib/supabase/env";

export type MagicLinkState = { status: "idle" | "sent" | "error"; message?: string };

/** Fixed site origin for auth redirects. Never derived from request headers. */
function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

const NEUTRAL = "If that address is allowed, a sign-in link is on its way. It opens your dashboard in this browser.";

export async function sendMagicLink(_prev: MagicLinkState, form: FormData): Promise<MagicLinkState> {
  const email = String(form.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "That doesn't look like an email address." };
  }
  if (!hasSupabaseEnv() || !process.env.OWNER_EMAIL) {
    return { status: "error", message: "Sign-in isn't configured yet. Set the Supabase env vars and OWNER_EMAIL." };
  }
  // Same response either way so the form never reveals who the owner is.
  if (!isOwnerEmail(email)) return { status: "sent", message: NEUTRAL };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback`, shouldCreateUser: true },
  });
  if (error) {
    console.error("[auth] signInWithOtp failed", error.message);
    return { status: "error", message: "Couldn't send a sign-in link right now. Try again in a minute." };
  }
  return { status: "sent", message: NEUTRAL };
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
