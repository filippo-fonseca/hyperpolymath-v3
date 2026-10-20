"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { EMAIL_RE, isRateLimited, passwordProblem, retryAfterSeconds, safeNextPath } from "@/lib/auth-errors";

export type AuthMode = "sign_in" | "sign_up" | "forgot";

export type AuthState =
  | { status: "idle"; mode: AuthMode; email?: string }
  | { status: "signed_in"; next: string }
  | { status: "check_email"; reason: "confirm" | "reset"; email: string; sentAt: number }
  | { status: "error"; mode: AuthMode; message: string; email?: string; field?: "email" | "password"; unconfirmed?: boolean }
  | { status: "rate_limited"; mode: AuthMode; email: string; retryAfter: number; at: number };

export type PasswordState =
  | { status: "idle" }
  | { status: "done" }
  | { status: "error"; message: string; field?: "password" };

/** Fixed site origin for auth redirects. Never derived from request headers. */
function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

type Fields = { email: string; password: string; next: string };

function fields(form: FormData): Fields {
  return {
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
    next: safeNextPath(String(form.get("next") ?? "") || null),
  };
}

/** Shared checks for every form. Returns an error state or null. */
function precheck(mode: AuthMode, { email, password }: Fields, needsPassword: boolean): AuthState | null {
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { status: "error", mode, field: "email", email, message: "That doesn't look like an email address." };
  }
  if (needsPassword && !password) {
    return { status: "error", mode, field: "password", email, message: "Enter your password." };
  }
  if (!hasSupabaseEnv()) {
    return { status: "error", mode, email, message: "Sign-in isn't configured yet. Set the Supabase env vars." };
  }
  return null;
}

type AuthErr = { code?: string; name?: string; status?: number; message?: string };

function unavailable(mode: AuthMode, email: string, what: string, e: unknown): AuthState {
  const err = e as AuthErr | undefined;
  console.error(`[auth] ${what} failed`, err?.code ?? err?.name ?? e, err?.status);
  return { status: "error", mode, email, message: "Couldn't reach the sign-in service. Try again in a minute." };
}

function limited(mode: AuthMode, email: string, error: AuthErr): AuthState {
  return { status: "rate_limited", mode, email, retryAfter: retryAfterSeconds(error), at: Date.now() };
}

export async function signInWithPassword(_prev: AuthState, form: FormData): Promise<AuthState> {
  const f = fields(form);
  const bad = precheck("sign_in", f, true);
  if (bad) return bad;
  try {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
    if (!error) return { status: "signed_in", next: f.next };
    if (isRateLimited(error)) return limited("sign_in", f.email, error);
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        mode: "sign_in",
        email: f.email,
        unconfirmed: true,
        message: "Confirm your email first. The link is in the email we sent when you signed up.",
      };
    }
    if (error.code === "invalid_credentials" || error.status === 400) {
      return { status: "error", mode: "sign_in", field: "password", email: f.email, message: "That email and password don't match." };
    }
    return unavailable("sign_in", f.email, "signInWithPassword", error);
  } catch (e) {
    return unavailable("sign_in", f.email, "signInWithPassword", e);
  }
}

export async function signUpWithPassword(_prev: AuthState, form: FormData): Promise<AuthState> {
  const f = fields(form);
  const bad = precheck("sign_up", f, true);
  if (bad) return bad;
  const weak = passwordProblem(f.password);
  if (weak) return { status: "error", mode: "sign_up", field: "password", email: f.email, message: weak };
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signUp({
      email: f.email,
      password: f.password,
      options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
    });
    if (!error) {
      // With email confirmation off, the account is live right away.
      if (data.session) return { status: "signed_in", next: f.next };
      return { status: "check_email", reason: "confirm", email: f.email, sentAt: Date.now() };
    }
    if (isRateLimited(error)) return limited("sign_up", f.email, error);
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { status: "error", mode: "sign_up", field: "email", email: f.email, message: "There's already an account with that email. Sign in instead." };
    }
    if (error.code === "weak_password") {
      return { status: "error", mode: "sign_up", field: "password", email: f.email, message: "Pick a stronger password: longer, and not one used on other sites." };
    }
    if (error.code === "signup_disabled") {
      return { status: "error", mode: "sign_up", email: f.email, message: "New accounts are closed right now." };
    }
    return unavailable("sign_up", f.email, "signUp", error);
  } catch (e) {
    return unavailable("sign_up", f.email, "signUp", e);
  }
}

/** Send the confirmation email again for an account that hasn't confirmed yet. */
export async function resendConfirmation(_prev: AuthState, form: FormData): Promise<AuthState> {
  const f = fields(form);
  const bad = precheck("sign_in", f, false);
  if (bad) return bad;
  try {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: f.email,
      options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
    });
    if (error && isRateLimited(error)) return limited("sign_in", f.email, error);
    if (error) return unavailable("sign_in", f.email, "resend", error);
    return { status: "check_email", reason: "confirm", email: f.email, sentAt: Date.now() };
  } catch (e) {
    return unavailable("sign_in", f.email, "resend", e);
  }
}

/** Email a reset link. Same answer whether or not the account exists. */
export async function requestPasswordReset(_prev: AuthState, form: FormData): Promise<AuthState> {
  const f = fields(form);
  const bad = precheck("forgot", f, false);
  if (bad) return bad;
  try {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.resetPasswordForEmail(f.email, {
      redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
    });
    if (error && isRateLimited(error)) return limited("forgot", f.email, error);
    if (error) return unavailable("forgot", f.email, "resetPasswordForEmail", error);
    return { status: "check_email", reason: "reset", email: f.email, sentAt: Date.now() };
  } catch (e) {
    return unavailable("forgot", f.email, "resetPasswordForEmail", e);
  }
}

/** Set a new password for the signed-in account (after a reset link, or from settings). */
export async function updatePassword(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const password = String(form.get("password") ?? "");
  const weak = passwordProblem(password);
  if (weak) return { status: "error", field: "password", message: weak };
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) return { status: "error", message: "Your reset link has expired. Request a new one from the sign-in page." };
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) return { status: "done" };
    if (error.code === "same_password") return { status: "error", field: "password", message: "That's your current password. Pick a new one." };
    if (error.code === "weak_password") {
      return { status: "error", field: "password", message: "Pick a stronger password: longer, and not one used on other sites." };
    }
    console.error("[auth] updateUser failed", error.code ?? error.name, error.status);
  } catch (e) {
    console.error("[auth] updateUser threw", e instanceof Error ? e.name : e);
  }
  return { status: "error", message: "Couldn't save your password. Try again in a minute." };
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
