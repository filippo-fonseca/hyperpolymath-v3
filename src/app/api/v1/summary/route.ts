import { appRoute } from "@/server/app-route";
import { appSummary } from "@/server/app-api";

// GET /api/v1/summary: everything the app's home screen and widgets show, in one call.
export const GET = appRoute(({ ctx }) => appSummary(ctx));
