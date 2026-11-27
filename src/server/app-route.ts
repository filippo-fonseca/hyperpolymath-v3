import "server-only";
import { ZodError } from "zod";
import { adminDb, AppError, makeCtx, type Ctx } from "./ctx";
import { resolveToken, type VerifiedToken } from "./tokens";
import { scopeAllows } from "@/lib/token-scope";

// Shared plumbing for /api/v1 (the native apps' API): bearer auth with an app
// or full token, a Ctx acting as you, JSON errors, and no caching. Handlers
// stay one line each.

function bearer(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-api-key")?.trim() || null;
}

const HEADERS = { "cache-control": "no-store" };

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: HEADERS });

const fail = (status: number, error: string, code?: string) => json({ error, ...(code ? { code } : {}) }, status);

export type AppHandler<P> = (input: { ctx: Ctx; req: Request; params: P; token: VerifiedToken }) => Promise<unknown>;

/** Read a JSON body, treating an empty or malformed one as {}. */
export async function body(req: Request): Promise<unknown> {
  return req.json().catch(() => ({}));
}

/**
 * Wrap an app API handler. The token must be valid and allowed on the app
 * surface. Writes act as you (the owner), so the activity log reads "you".
 */
export function appRoute<P = Record<string, never>>(handler: AppHandler<P>, opts: { status?: number } = {}) {
  return async (req: Request, route: { params: Promise<P> }) => {
    const presented = bearer(req);
    const token = presented ? await resolveToken(adminDb(), presented) : null;
    if (!token) {
      return Response.json(
        { error: "Missing or invalid token", code: "unauthorized" },
        { status: 401, headers: { ...HEADERS, "www-authenticate": 'Bearer realm="hyperpolymath"' } },
      );
    }
    if (!scopeAllows(token.scope, "app")) return fail(403, "This token can't use the app API", "forbidden");
    try {
      const ctx = await makeCtx(token.userId, { kind: "user", name: "you" });
      const params = (await route?.params) ?? ({} as P);
      return json(await handler({ ctx, req, params, token }), opts.status);
    } catch (e) {
      if (e instanceof ZodError) {
        return fail(400, e.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; "), "invalid");
      }
      if (e instanceof AppError) return fail(e.code === "not_found" ? 404 : e.code === "conflict" ? 409 : 400, e.message, e.code);
      console.error("[api/v1]", e);
      return fail(500, "Something went wrong", "server");
    }
  };
}
