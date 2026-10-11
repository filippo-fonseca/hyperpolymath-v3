import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";

export type DB = SupabaseClient<Database>;
export type Tables = Database["public"]["Tables"];
export type Row<T extends keyof Tables> = Tables[T]["Row"];
export type Update<T extends keyof Tables> = Tables[T]["Update"];

export type Actor =
  | { kind: "user"; name: "you" }
  | { kind: "bot"; name: string; botId: string }
  | { kind: "system"; name: string };

/** Everything a service function needs: who is acting, for whom, and how. */
export type Ctx = {
  db: DB;
  userId: string;
  actor: Actor;
  tz: string;
  now: Date;
};

export class AppError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "invalid" | "conflict" | "unauthorized" = "invalid",
  ) {
    super(message);
  }
}

let admin: DB | null = null;

/** Server-only client with the secret key. Always scope queries by user_id. */
export function adminDb(): DB {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("Supabase env vars missing (see scripts/pull-env.sh)");
    admin = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

export async function userTimezone(db: DB, userId: string): Promise<string> {
  const { data } = await db.from("settings").select("timezone").eq("user_id", userId).maybeSingle();
  return data?.timezone ?? "America/New_York";
}

export async function makeCtx(userId: string, actor: Actor): Promise<Ctx> {
  const db = adminDb();
  return { db, userId, actor, tz: await userTimezone(db, userId), now: new Date() };
}

export function must<T>(res: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (res.error) throw new AppError(`${what}: ${res.error.message}`);
  if (res.data === null || res.data === undefined) throw new AppError(`${what}: not found`, "not_found");
  return res.data as NonNullable<T>;
}

export const asJson = (v: unknown) => v as Json;

/** Escape LIKE wildcards so user/bot input matches literally in ilike(). */
export const escapeLike = (v: string) => v.replace(/[\\%_]/g, "\\$&");
