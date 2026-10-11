import "server-only";
import { refresh } from "next/cache";
import { ZodError } from "zod";
import { AppError, type Ctx } from "@/server/ctx";
import { requireUser, userCtx } from "@/lib/session";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: AppError["code"] };

function message(e: unknown): { error: string; code?: AppError["code"] } {
  if (e instanceof AppError) return { error: e.message, code: e.code };
  if (e instanceof ZodError) {
    return { error: e.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ") };
  }
  console.error(e);
  return { error: "Something went wrong. Try again." };
}

/**
 * Run a service call as you. Auth is checked first (outside the try so a
 * redirect to /login propagates), errors come back as plain data, and the
 * client router refreshes after a successful write.
 */
export async function asUser<T>(fn: (ctx: Ctx) => Promise<T>, opts: { write?: boolean } = {}): Promise<Result<T>> {
  await requireUser();
  try {
    const ctx = await userCtx();
    const data = await fn(ctx);
    if (opts.write !== false) refresh();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, ...message(e) };
  }
}

/** For reads that don't change anything. */
export function readAsUser<T>(fn: (ctx: Ctx) => Promise<T>) {
  return asUser(fn, { write: false });
}
