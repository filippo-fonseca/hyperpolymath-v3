import { adminDb, AppError, makeCtx } from "@/server/ctx";
import { createCapture } from "@/server/captures";
import { verifyToken } from "@/server/tokens";
import { authFailures, CAPTURE_LIMIT, clientIp, hit, limitHeaders } from "@/server/rate-limit";
import { scopesFor } from "@/lib/token-scope";

// Quick capture from anywhere (iOS Shortcut, Raycast, curl):
//   POST /api/capture  Authorization: Bearer hpm_...  {"content": "...", "source": "shortcut"}
// Plain-text bodies work too.

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (authFailures.blocked(ip)) {
    const v = authFailures.peek(ip);
    return Response.json({ error: "Too many invalid tokens. Try again later." }, { status: 429, headers: limitHeaders(v) });
  }
  const auth = req.headers.get("authorization");
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  const userId = token ? await verifyToken(adminDb(), token, scopesFor("capture")) : null;
  if (!userId) {
    authFailures.hit(ip);
    return Response.json({ error: "Missing or invalid token" }, { status: 401 });
  }
  const limit = await hit(adminDb(), `capture:${userId}`, CAPTURE_LIMIT);
  const headers = limitHeaders(limit);
  if (!limit.ok) {
    return Response.json({ error: `Slow down: ${limit.limit} captures a minute. Retry in ${limit.resetIn}s.` }, { status: 429, headers });
  }

  // Captures are short notes; refuse anything that is plainly not one before reading it.
  if (Number(req.headers.get("content-length") ?? 0) > 100_000) {
    return Response.json({ error: "Capture too large (100 KB max)" }, { status: 413, headers });
  }

  let content = "";
  let source = "shortcut";
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { content?: unknown; source?: unknown };
    content = typeof body.content === "string" ? body.content : "";
    if (typeof body.source === "string" && body.source.trim()) source = body.source.trim().slice(0, 40);
  } else {
    content = await req.text();
  }

  try {
    const ctx = await makeCtx(userId, { kind: "system", name: source });
    const capture = await createCapture(ctx, { content: content.slice(0, 20000) });
    return Response.json({ id: capture.id, captured: true }, { status: 201, headers });
  } catch (e) {
    if (e instanceof AppError) return Response.json({ error: e.message }, { status: 400, headers });
    console.error("[capture]", e);
    return Response.json({ error: "Capture failed" }, { status: 500 });
  }
}
