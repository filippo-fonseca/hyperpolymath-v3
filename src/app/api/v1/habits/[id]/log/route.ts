import { z } from "zod";
import { appRoute, body } from "@/server/app-route";
import { appLogHabit } from "@/server/app-api";
import { appLogHabitSchema } from "@/lib/app-api";

// POST /api/v1/habits/:id/log {"progress": 0-3}. Defaults to done for today.
export const POST = appRoute<{ id: string }>(async ({ ctx, req, params }) =>
  appLogHabit(ctx, z.uuid().parse(params.id), appLogHabitSchema.parse(await body(req)).progress),
);
