import { z } from "zod";
import { appRoute } from "@/server/app-route";
import { appReopenTask } from "@/server/app-api";

// POST /api/v1/tasks/:id/reopen: undo a completion from the app.
export const POST = appRoute<{ id: string }>(({ ctx, params }) => appReopenTask(ctx, z.uuid().parse(params.id)));
