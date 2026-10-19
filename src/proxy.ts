import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Refreshes the Supabase session cookie on every page request, shows
// signed-out visitors to `/` the public landing page (a rewrite to /welcome,
// so the URL stays `/`), sends them from the rest of the app to /login, and
// sends a signed-in account away from /login. This is an optimistic check only:
// every Server Component and Server Action re-verifies the session itself.
// Unknown paths pass through so they render the 404 page.

/** Routes that need a session. Everything else is public or a 404. */
const PRIVATE = (pathname: string) => pathname === "/" || pathname.startsWith("/api/google/");

/** A signed-out page view of `/` gets the landing page instead of a redirect. */
const LANDING = (request: NextRequest) =>
  request.nextUrl.pathname === "/" && (request.method === "GET" || request.method === "HEAD");

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = !PRIVATE(pathname);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    // Not configured: show the landing page and let /login render its setup notice.
    if (LANDING(request)) return NextResponse.rewrite(new URL("/welcome", request.url));
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
  const signedIn = !!data?.claims?.sub;

  const go = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  };
  if (!signedIn && LANDING(request)) {
    const rewrite = NextResponse.rewrite(new URL("/welcome", request.url), { request });
    for (const c of response.cookies.getAll()) rewrite.cookies.set(c);
    return rewrite;
  }
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
