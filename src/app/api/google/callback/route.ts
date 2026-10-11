import { NextResponse, type NextRequest } from "next/server";
import { currentUserId } from "@/lib/session";
import { adminDb, AppError } from "@/server/ctx";
import { connectAccount } from "@/server/google/oauth";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;
  const done = (status: string) => {
    const res = NextResponse.redirect(new URL(`/?google=${encodeURIComponent(status)}`, origin));
    res.cookies.delete({ name: "g_oauth_state", path: "/api/google" });
    return res;
  };

  const userId = await currentUserId();
  if (!userId) return NextResponse.redirect(new URL("/login", origin));
  const state = url.searchParams.get("state");
  const expected = req.cookies.get("g_oauth_state")?.value;
  if (!state || !expected || state !== expected) return done("state_mismatch");
  if (url.searchParams.get("error")) return done(url.searchParams.get("error")!);
  const code = url.searchParams.get("code");
  if (!code) return done("missing_code");

  try {
    await connectAccount(adminDb(), userId, code, `${origin}/api/google/callback`);
    return done("connected");
  } catch (e) {
    console.error("[google callback]", e);
    return done(e instanceof AppError ? "error" : "failed");
  }
}
