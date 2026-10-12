import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isOwnerEmail } from "@/lib/supabase/env";

// Refreshes the Supabase session cookie on every page request, sends
// signed-out visitors from the app to /login, and sends a signed-in owner
// away from /login. This is an optimistic check only: every Server Component
// and Server Action re-verifies the session itself. Unknown paths pass
// through so they render the 404 page.

/** Routes that need a session. Everything else is public or a 404. */
const PRIVATE = (pathname: string) => pathname === "/" || pathname.startsWith("/api/google/");

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = !PRIVATE(pathname);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    // Not configured: let /login render its setup notice.
    return isPublic ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet, headers) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  // Must run before anything else so a refreshed token is written back.
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  const signedIn = !!data?.claims && isOwnerEmail(email);

  const go = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  };
  if (!signedIn && !isPublic) return go("/login");
  if (signedIn && pathname === "/login") return go("/");
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, app icons, the manifest, MCP, cron and token capture.
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|brand/|api/mcp|api/cron|api/capture|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
