import { z } from "zod";
import { appRoute } from "@/server/app-route";
import { appCompleteTask } from "@/server/app-api";

// POST /api/v1/tasks/:id/complete. Recurring tasks roll to their next date.
export const POST = appRoute<{ id: string }>(({ ctx, params }) => appCompleteTask(ctx, z.uuid().parse(params.id)));
