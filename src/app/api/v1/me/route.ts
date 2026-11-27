import { appRoute } from "@/server/app-route";
import { appMe } from "@/server/app-api";

// GET /api/v1/me: who this token belongs to. The apps call it to confirm a connection.
export const GET = appRoute(({ ctx, token }) => appMe(ctx, token));
