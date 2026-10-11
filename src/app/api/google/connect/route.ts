import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { authUrl } from "@/server/google/oauth";

// Starts Google OAuth. The state value is kept in a short-lived httpOnly
// cookie and checked in the callback.

export async function GET(req: Request) {
  const userId = await currentUserId();
  const origin = new URL(req.url).origin;
  if (!userId) return NextResponse.redirect(new URL("/login", origin));
  const state = randomBytes(16).toString("base64url");
  const res = NextResponse.redirect(authUrl(`${origin}/api/google/callback`, state));
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    path: "/api/google",
    maxAge: 600,
  });
  return res;
}
