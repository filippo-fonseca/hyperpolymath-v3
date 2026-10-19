import "server-only";
import { AppError, must, type Ctx, type DB } from "./ctx";
import { decrypt, encrypt } from "./google/crypto";
import { isOwnerEmail } from "@/lib/supabase/env";

// Where each account's due reminders go: its own Grok Bot "Reminder relay"
// webhook, saved in Settings. The token is encrypted at rest (same key as the
// Google tokens) and the table has no RLS policies, so only the server reads
// it. KIWI_WEBHOOK_URL/TOKEN in env still work, but only for OWNER_EMAIL, so
// one account's reminders can never reach another account's bot.

export type Relay = { url: string; token: string };
export type RelayStatus = { configured: boolean; source: "account" | "env" | null; host: string | null };

function envRelay(): Relay | null {
  const url = process.env.KIWI_WEBHOOK_URL;
  const token = process.env.KIWI_WEBHOOK_TOKEN;
  return url && token ? { url, token } : null;
}

async function isOwner(db: DB, userId: string) {
  const { data } = await db.from("profiles").select("email").eq("id", userId).maybeSingle();
  return isOwnerEmail(data?.email);
}

/** The relay for this account, or null when none is set up. */
export async function getRelay(db: DB, userId: string): Promise<Relay | null> {
  const { data, error } = await db.from("reminder_relays").select("url, token_enc").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`relay lookup: ${error.message}`);
  if (data) return { url: data.url, token: decrypt(data.token_enc) };
  const env = envRelay();
  return env && (await isOwner(db, userId)) ? env : null;
}

export async function relayStatus(db: DB, userId: string): Promise<RelayStatus> {
  const { data } = await db.from("reminder_relays").select("url").eq("user_id", userId).maybeSingle();
  if (data) return { configured: true, source: "account", host: new URL(data.url).host };
  const env = envRelay();
  if (env && (await isOwner(db, userId))) return { configured: true, source: "env", host: new URL(env.url).host };
  return { configured: false, source: null, host: null };
}

/** Save this account's relay webhook. Only https URLs; the token is stored encrypted. */
export async function setRelay(ctx: Ctx, input: { url: string; token: string }) {
  let url: URL;
  try {
    url = new URL(input.url.trim());
  } catch {
    throw new AppError("That webhook URL isn't a valid link.");
  }
  if (url.protocol !== "https:") throw new AppError("The webhook URL has to start with https://.");
  const token = input.token.trim();
  if (!token) throw new AppError("Paste the webhook key too.");
  if (!process.env.GOOGLE_TOKEN_KEY) throw new AppError("The server has no encryption key (GOOGLE_TOKEN_KEY), so it can't store webhook keys yet.");
  must(
    await ctx.db
      .from("reminder_relays")
      .upsert({ user_id: ctx.userId, url: url.toString(), token_enc: encrypt(token) }, { onConflict: "user_id" })
      .select("user_id")
      .single(),
    "save relay",
  );
  return relayStatus(ctx.db, ctx.userId);
}

export async function clearRelay(ctx: Ctx) {
  const { error } = await ctx.db.from("reminder_relays").delete().eq("user_id", ctx.userId);
  if (error) throw new Error(`remove relay: ${error.message}`);
  return relayStatus(ctx.db, ctx.userId);
}
