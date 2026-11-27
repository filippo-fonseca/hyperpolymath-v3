import { z } from "zod";
import { appRoute, body } from "@/server/app-route";
import { appCaptures, appCreateCapture } from "@/server/app-api";
import { appCreateCaptureSchema } from "@/lib/app-api";

// GET  /api/v1/captures?limit=30
// POST /api/v1/captures {"content": "..."}

export const GET = appRoute(({ ctx, req }) =>
  appCaptures(ctx, z.coerce.number().int().min(1).max(200).parse(new URL(req.url).searchParams.get("limit") ?? 30)),
);

export const POST = appRoute(async ({ ctx, req }) => appCreateCapture(ctx, appCreateCaptureSchema.parse(await body(req)).content), {
  status: 201,
});
