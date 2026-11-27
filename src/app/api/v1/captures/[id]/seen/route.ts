import { z } from "zod";
import { appRoute } from "@/server/app-route";
import { appMarkCaptureSeen } from "@/server/app-api";

// POST /api/v1/captures/:id/seen: clear a resurfaced capture.
export const POST = appRoute<{ id: string }>(({ ctx, params }) => appMarkCaptureSeen(ctx, z.uuid().parse(params.id)));
