import { z } from "zod";
import { adminDb, AppError, makeCtx } from "@/server/ctx";
import { suggest } from "@/server/suggestions";
import { verifyToken } from "@/server/tokens";
import { isLocalDate, isLocalTime } from "@/lib/time";
import { BATCH_LIMIT } from "@/lib/suggestions";

// Suggestions over plain HTTP, for agents without MCP (a ChatGPT action, a
// script, an automation). Same rules as the MCP suggest tool: items wait in
// the Suggested tray until the owner reviews them.
//   POST /api/suggest  Authorization: Bearer hpm_...
//   {"source": "my-agent", "items": [{"kind": "task", "content": "...", "reason": "..."}]}
// A single item can also be sent at the top level instead of "items".

const item = z.object({
  kind: z.enum(["task", "capture"]),
  content: z.string().min(1).max(2000),
  reason: z.string().max(300).optional(),
  project: z.string().max(120).optional(),
  due_date: z.string().refine(isLocalDate, "YYYY-MM-DD").optional(),
  due_time: z.string().refine(isLocalTime, "HH:MM").optional(),
  priority: z.number().int().min(0).max(3).optional(),
  notes: z.string().max(4000).optional(),
});
const body = z.object({
  source: z.string().trim().min(1).max(40).optional(),
  items: z.array(item).min(1).max(BATCH_LIMIT),
});

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  const userId = token ? await verifyToken(adminDb(), token) : null;
  if (!userId) return Response.json({ error: "Missing or invalid token" }, { status: 401 });

  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = body.safeParse(raw && !("items" in raw) ? { source: raw.source, items: [raw] } : raw);
  if (!parsed.success) {
    const error = parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    return Response.json({ error }, { status: 400 });
  }

  try {
    const ctx = await makeCtx(userId, { kind: "system", name: parsed.data.source ?? "api" });
    const results = await suggest(ctx, parsed.data.items);
    return Response.json({ results }, { status: 201 });
  } catch (e) {
    if (e instanceof AppError) return Response.json({ error: e.message }, { status: e.code === "conflict" ? 429 : 400 });
    console.error("[suggest]", e);
    return Response.json({ error: "Suggest failed" }, { status: 500 });
  }
}
