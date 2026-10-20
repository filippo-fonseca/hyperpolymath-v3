import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { reasonFromAuthError, reasonFromParams, safeNextPath, type LoginErrorReason } from "@/lib/auth-errors";

// Landing for the links Supabase emails: confirming a new account and
// resetting a password. Supports the PKCE `code` flow and the `token_hash`
// flow (depending on how the email template is configured), plus the error
// params Supabase appends when a link fails before it reaches us. Redirects
// only to same-origin paths. A password reset lands on /reset-password.

const OTP_TYPES = new Set<EmailOtpType>(["magiclink", "email", "signup", "invite", "recovery", "email_change"]);

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const to = (path: string) => NextResponse.redirect(new URL(path, origin));
  const fail = (reason: LoginErrorReason) => to(`/login?error=${reason}`);

  if (!hasSupabaseEnv()) return fail("auth_unavailable");

  const supabase = await supabaseServer();

  /** An old or reused link is harmless when someone is already signed in. */
  const alreadySignedIn = async () => {
    try {
      const { data } = await supabase.auth.getClaims();
      return !!data?.claims?.sub;
    } catch {
      return false;
    }
  };

  const paramError = reasonFromParams(searchParams);
  if (paramError) {
    if (await alreadySignedIn()) return to(next);
    return fail(paramError);
  }

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");

  try {
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        if (await alreadySignedIn()) return to(next);
        console.warn("[auth] code exchange failed", error.code ?? error.name, error.status);
        return fail(reasonFromAuthError(error));
      }
      if (!data.user) return fail("link_invalid");
    } else if (tokenHash && rawType && OTP_TYPES.has(rawType as EmailOtpType)) {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: rawType as EmailOtpType });
      if (error) {
        if (await alreadySignedIn()) return to(next);
        console.warn("[auth] otp verify failed", error.code ?? error.name, error.status);
        return fail(reasonFromAuthError(error));
      }
      if (!data.user) return fail("link_invalid");
    } else {
      if (await alreadySignedIn()) return to(next);
      return fail("link_invalid");
    }
  } catch (e) {
    // Network failures reaching Supabase surface as thrown errors.
    console.error("[auth] callback failed", e instanceof Error ? e.name : e);
    const name = e instanceof Error ? e.name : "";
    return fail(name === "AuthPKCECodeVerifierMissingError" ? "link_other_browser" : "auth_unavailable");
  }

  // Reset emails carry next=/reset-password; a bare recovery token goes there too.
  return to(rawType === "recovery" ? "/reset-password" : next);
}
