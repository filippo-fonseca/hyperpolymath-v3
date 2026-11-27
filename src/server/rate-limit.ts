import "server-only";
import type { DB } from "./ctx";

// Rate limits for the token endpoints (/api/mcp and /api/capture).
//
// Two layers:
//  1. Per account, in Postgres (`rate_limit_hit`, see supabase/migrations). Every
//     serverless instance shares the count, so this is the real limit. If the
//     database call fails (for example the migration isn't applied yet) the
//     request goes through: a broken limiter must never lock you out of your
//     own data.
//  2. Failed sign-ins per IP, in memory. Tokens are 192 random bits, so this
//     isn't about guessing them; it stops a flood of bad tokens from costing a
//     database lookup each. Per instance and best effort by design.

export type Limit = { limit: number; windowSeconds: number };

/** Bots batch their work, so a minute of 240 tool calls is already a runaway loop. */
export const MCP_LIMIT: Limit = { limit: 240, windowSeconds: 60 };
/** Captures come from a person tapping a Shortcut; 30 a minute is generous. */
export const CAPTURE_LIMIT: Limit = { limit: 30, windowSeconds: 60 };
/** Bad tokens from one IP before it has to wait out the window. */
export const AUTH_FAILURE_LIMIT: Limit = { limit: 20, windowSeconds: 300 };

export type Verdict = {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window ends. */
  resetIn: number;
};

/** Start of the fixed window containing `nowMs`, matching the SQL function. */
export function windowStart(nowMs: number, windowSeconds: number) {
  const size = windowSeconds * 1000;
  return Math.floor(nowMs / size) * size;
}

export function verdict(hits: number, { limit, windowSeconds }: Limit, nowMs = Date.now()): Verdict {
  const end = windowStart(nowMs, windowSeconds) + windowSeconds * 1000;
  return {
    ok: hits <= limit,
    limit,
    remaining: Math.max(limit - hits, 0),
    resetIn: Math.max(Math.ceil((end - nowMs) / 1000), 1),
  };
}

let warned = false;

/** Count one request against `key` and say whether it is within `limit`. Fails open. */
export async function hit(db: DB, key: string, limit: Limit): Promise<Verdict> {
  const { data, error } = await db.rpc("rate_limit_hit", { p_key: key, p_window_seconds: limit.windowSeconds });
  if (error || typeof data !== "number") {
    if (!warned) {
      warned = true;
      console.warn("[rate-limit] not enforced:", error?.message ?? "unexpected response");
    }
    return { ok: true, limit: limit.limit, remaining: limit.limit, resetIn: limit.windowSeconds };
  }
  return verdict(data, limit);
}

/** A small fixed-window counter kept in this instance's memory. */
export class MemoryLimiter {
  private hits = new Map<string, { start: number; n: number }>();

  constructor(
    private readonly rule: Limit,
    private readonly maxKeys = 5000,
    private readonly now: () => number = Date.now,
  ) {}

  private current(key: string) {
    const start = windowStart(this.now(), this.rule.windowSeconds);
    const entry = this.hits.get(key);
    return entry && entry.start === start ? entry : { start, n: 0 };
  }

  /** How things stand for `key` without counting anything. */
  peek(key: string): Verdict {
    return verdict(this.current(key).n, this.rule, this.now());
  }

  /** Is `key` already over the limit? */
  blocked(key: string) {
    return this.current(key).n >= this.rule.limit;
  }

  /** Count one event for `key`. */
  hit(key: string): Verdict {
    const entry = this.current(key);
    entry.n += 1;
    this.hits.delete(key); // re-insert so the Map stays ordered oldest first
    this.hits.set(key, entry);
    while (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest === undefined) break;
      this.hits.delete(oldest);
    }
    return verdict(entry.n, this.rule, this.now());
  }

  get size() {
    return this.hits.size;
  }
}

/** Failed token checks, shared by both token endpoints in this instance. */
export const authFailures = new MemoryLimiter(AUTH_FAILURE_LIMIT);

/** The caller's IP as Vercel (or any proxy) reports it. */
export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Standard rate limit headers (IETF draft `RateLimit-*`, plus `Retry-After` on a 429). */
export function limitHeaders(v: Verdict): Record<string, string> {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(v.limit),
    "RateLimit-Remaining": String(v.remaining),
    "RateLimit-Reset": String(v.resetIn),
  };
  if (!v.ok) headers["Retry-After"] = String(v.resetIn);
  return headers;
}
