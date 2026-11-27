import { z } from "zod";
import { appRoute, body } from "@/server/app-route";
import { appCreateTask, appTasks } from "@/server/app-api";
import { appCreateTaskSchema, appTaskScopeSchema } from "@/lib/app-api";

// GET  /api/v1/tasks?scope=today|upcoming|inbox|open|done&limit=100
// POST /api/v1/tasks {"text": "Call the bank tomorrow 5pm p1 #Admin"} (quick add)

export const GET = appRoute(({ ctx, req }) => {
  const url = new URL(req.url);
  const scope = appTaskScopeSchema.parse(url.searchParams.get("scope") ?? "open");
  const limit = z.coerce.number().int().min(1).max(500).parse(url.searchParams.get("limit") ?? 100);
  return appTasks(ctx, scope, limit);
});

export const POST = appRoute(async ({ ctx, req }) => appCreateTask(ctx, appCreateTaskSchema.parse(await body(req)).text), { status: 201 });
