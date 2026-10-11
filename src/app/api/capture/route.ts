import { adminDb, AppError, makeCtx } from "@/server/ctx";
import { createCapture } from "@/server/captures";
import { verifyToken } from "@/server/tokens";

// Quick capture from anywhere (iOS Shortcut, Raycast, curl):
//   POST /api/capture  Authorization: Bearer hpm_...  {"content": "...", "source": "shortcut"}
// Plain-text bodies work too.

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  const userId = token ? await verifyToken(adminDb(), token) : null;
  if (!userId) return Response.json({ error: "Missing or invalid token" }, { status: 401 });

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
    return Response.json({ id: capture.id, captured: true }, { status: 201 });
  } catch (e) {
    if (e instanceof AppError) return Response.json({ error: e.message }, { status: 400 });
    console.error("[capture]", e);
    return Response.json({ error: "Capture failed" }, { status: 500 });
  }
}
