"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { hasSupabaseEnv, isOwnerEmail } from "@/lib/supabase/env";

export type MagicLinkState = { status: "idle" | "sent" | "refused" | "error"; message?: string };

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function sendMagicLink(_prev: MagicLinkState, form: FormData): Promise<MagicLinkState> {
  const email = String(form.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "That doesn't look like an email address." };
  }
  if (!hasSupabaseEnv() || !process.env.OWNER_EMAIL) {
    return { status: "error", message: "Sign-in isn't configured yet. Set the Supabase env vars and OWNER_EMAIL." };
  }
  if (!isOwnerEmail(email)) {
    return {
      status: "refused",
      message: "Thanks for stopping by. This is a private dashboard with a single owner, so sign-in is closed to other addresses.",
    };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await origin()}/auth/callback`, shouldCreateUser: true },
  });
  if (error) return { status: "error", message: error.message };
  return { status: "sent", message: email };
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
