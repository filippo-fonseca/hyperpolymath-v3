// Account isolation against a real Supabase project. Runs only when
// SUPABASE_SECRET_KEY is available (e.g. from .env.local). Two throwaway
// accounts are created and deleted afterwards (all rows cascade).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { adminDb, type Ctx } from "./ctx";
import { createTask } from "./tasks";
import { clearRelay, getRelay, setRelay } from "./relay";

const enabled = !!(
  process.env.SUPABASE_SECRET_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

type Account = { id: string; email: string; password: string };

describe.skipIf(!enabled)("accounts (live DB)", () => {
  const a: Account = { id: "", email: `it-a-${randomUUID()}@example.com`, password: randomUUID() };
  const b: Account = { id: "", email: `it-b-${randomUUID()}@example.com`, password: randomUUID() };
  const ctx = (userId: string): Ctx => ({ db: adminDb(), userId, actor: { kind: "user", name: "you" }, tz: "UTC", now: new Date() });

  /** A browser-style client signed in as `acc`, so RLS applies. */
  const signedIn = async (acc: Account) => {
    const client = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.signInWithPassword({ email: acc.email, password: acc.password });
    if (error) throw error;
    return client;
  };

  beforeAll(async () => {
    for (const acc of [a, b]) {
      const { data, error } = await adminDb().auth.admin.createUser({ email: acc.email, password: acc.password, email_confirm: true });
      if (error) throw error;
      acc.id = data.user.id;
    }
  });

  afterAll(async () => {
    for (const acc of [a, b]) if (acc.id) await adminDb().auth.admin.deleteUser(acc.id);
  });

  it("records every new account in profiles", async () => {
    const { data } = await adminDb().from("profiles").select("id, email").in("id", [a.id, b.id]);
    expect(data?.map((p) => p.email).sort()).toEqual([a.email, b.email].sort());
  });

  it("lets an account read only its own rows", async () => {
    const task = await createTask(ctx(a.id), { title: "only for A" });
    const asB = await signedIn(b);
    const { data: seenByB } = await asB.from("tasks").select("id").eq("id", task.id);
    expect(seenByB).toEqual([]);
    const { data: profilesSeenByB } = await asB.from("profiles").select("id");
    expect(profilesSeenByB?.map((p) => p.id)).toEqual([b.id]);

    const asA = await signedIn(a);
    const { data: seenByA } = await asA.from("tasks").select("id").eq("id", task.id);
    expect(seenByA?.map((t) => t.id)).toEqual([task.id]);
  });

  it("refuses writes from the browser, even to your own rows", async () => {
    const asB = await signedIn(b);
    const { error: insertError } = await asB.from("tasks").insert({ user_id: b.id, title: "sneaky" });
    expect(insertError).not.toBeNull();
    const { data: updated } = await asB.from("tasks").update({ title: "hijacked" }).eq("user_id", a.id).select("id");
    expect(updated ?? []).toEqual([]);
  });

  it("keeps reminder relays per account and out of the browser's reach", async () => {
    const saved = { key: process.env.GOOGLE_TOKEN_KEY, url: process.env.KIWI_WEBHOOK_URL, token: process.env.KIWI_WEBHOOK_TOKEN };
    process.env.GOOGLE_TOKEN_KEY ??= randomBytes(32).toString("base64");
    // A server-wide relay exists, but neither test account is OWNER_EMAIL.
    process.env.KIWI_WEBHOOK_URL = "https://example.com/owner-relay";
    process.env.KIWI_WEBHOOK_TOKEN = "owner-token";
    try {
      expect(await getRelay(adminDb(), a.id)).toBeNull();
      await setRelay(ctx(a.id), { url: "https://example.com/a-relay", token: "a-token" });
      expect(await getRelay(adminDb(), a.id)).toEqual({ url: "https://example.com/a-relay", token: "a-token" });
      expect(await getRelay(adminDb(), b.id)).toBeNull();

      const asA = await signedIn(a);
      const { data: ownRelay } = await asA.from("reminder_relays").select("user_id");
      expect(ownRelay).toEqual([]);

      await clearRelay(ctx(a.id));
      expect(await getRelay(adminDb(), a.id)).toBeNull();
    } finally {
      for (const [k, v] of [["GOOGLE_TOKEN_KEY", saved.key], ["KIWI_WEBHOOK_URL", saved.url], ["KIWI_WEBHOOK_TOKEN", saved.token]] as const) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
