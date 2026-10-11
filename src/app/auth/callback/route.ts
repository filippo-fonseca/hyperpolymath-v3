import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/supabase/env";

// Magic link landing. Supports both the PKCE `code` flow and the
// `token_hash` flow, depending on how the email template is configured.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, origin));

  const supabase = await supabaseServer();
  let email: string | null | undefined = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("link_invalid");
    email = data.user?.email;
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail("link_invalid");
    email = data.user?.email;
  } else {
    return fail("link_invalid");
  }

  if (!isOwnerEmail(email)) {
    await supabase.auth.signOut();
    return fail("not_allowed");
  }
  return NextResponse.redirect(new URL("/", origin));
}
