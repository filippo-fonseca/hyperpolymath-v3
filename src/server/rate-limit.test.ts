import { describe, expect, it, vi } from "vitest";
import type { DB } from "./ctx";
import { clientIp, hit, limitHeaders, MemoryLimiter, verdict, windowStart } from "./rate-limit";

const rule = { limit: 3, windowSeconds: 60 };
const T0 = Date.UTC(2026, 10, 27, 12, 0, 0); // on a minute boundary

describe("windowStart", () => {
  it("snaps to the start of the fixed window, like the SQL function", () => {
    expect(windowStart(T0, 60)).toBe(T0);
    expect(windowStart(T0 + 59_999, 60)).toBe(T0);
    expect(windowStart(T0 + 60_000, 60)).toBe(T0 + 60_000);
    expect(windowStart(T0 + 299_000, 300)).toBe(T0);
  });
});

describe("verdict", () => {
  it("allows up to the limit and counts down what is left", () => {
    expect(verdict(1, rule, T0)).toEqual({ ok: true, limit: 3, remaining: 2, resetIn: 60 });
    expect(verdict(3, rule, T0 + 15_000)).toEqual({ ok: true, limit: 3, remaining: 0, resetIn: 45 });
  });

  it("refuses past the limit and never reports a negative remainder", () => {
    const v = verdict(9, rule, T0 + 59_500);
    expect(v.ok).toBe(false);
    expect(v.remaining).toBe(0);
    expect(v.resetIn).toBe(1); // rounds up, never 0
  });
});

describe("MemoryLimiter", () => {
  it("blocks a key once it reaches the limit, then lets it back in next window", () => {
    let now = T0;
    const m = new MemoryLimiter(rule, 100, () => now);
    expect(m.blocked("a")).toBe(false);
    expect(m.peek("a")).toMatchObject({ ok: true, remaining: 3 });
    m.hit("a");
    m.hit("a");
    expect(m.blocked("a")).toBe(false);
    expect(m.hit("a").ok).toBe(true);
    expect(m.blocked("a")).toBe(true);
    expect(m.peek("a")).toMatchObject({ ok: false, remaining: 0 });
    expect(m.hit("a").ok).toBe(false);
    expect(m.blocked("b")).toBe(false); // keys are independent

    now = T0 + 60_000;
    expect(m.blocked("a")).toBe(false);
    expect(m.hit("a")).toMatchObject({ ok: true, remaining: 2 });
  });

  it("forgets the least recently hit keys past its size cap", () => {
    const m = new MemoryLimiter(rule, 2, () => T0);
    m.hit("a");
    m.hit("a");
    m.hit("a");
    m.hit("b");
    m.hit("c");
    expect(m.size).toBe(2);
    expect(m.blocked("a")).toBe(false); // evicted, so it starts over
  });
});

describe("hit (database)", () => {
  const db = (result: { data: unknown; error: unknown }) =>
    ({ rpc: vi.fn().mockResolvedValue(result) }) as unknown as DB;

  it("asks Postgres for the count and judges it against the limit", async () => {
    const d = db({ data: 4, error: null });
    const v = await hit(d, "mcp:u1", rule);
    expect(d.rpc).toHaveBeenCalledWith("rate_limit_hit", { p_key: "mcp:u1", p_window_seconds: 60 });
    expect(v.ok).toBe(false);
  });

  it("fails open when the function is missing or errors", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const v = await hit(db({ data: null, error: { message: "function does not exist" } }), "mcp:u1", rule);
    expect(v).toMatchObject({ ok: true, remaining: 3 });
    warn.mockRestore();
  });
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for hop, then x-real-ip", () => {
    const req = (h: Record<string, string>) => new Request("https://x.test", { headers: h });
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(req({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(req({}))).toBe("unknown");
  });
});

describe("limitHeaders", () => {
  it("adds Retry-After only when refusing", () => {
    expect(limitHeaders({ ok: true, limit: 3, remaining: 1, resetIn: 20 })).not.toHaveProperty("Retry-After");
    expect(limitHeaders({ ok: false, limit: 3, remaining: 0, resetIn: 20 })).toMatchObject({
      "Retry-After": "20",
      "RateLimit-Limit": "3",
      "RateLimit-Remaining": "0",
      "RateLimit-Reset": "20",
    });
  });
});
