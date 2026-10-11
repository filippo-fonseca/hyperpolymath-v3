import "server-only";
import { AppError, must, type DB, type Row } from "../ctx";
import { decrypt, encrypt } from "./crypto";

export type GoogleAccount = Row<"google_accounts">;

const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar"];

function client() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new AppError("Google isn't configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");
  return { id, secret };
}

export function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_TOKEN_KEY);
}

export function authUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: client().id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || json.error) throw new AppError(`Google token error: ${json.error_description ?? json.error ?? res.status}`);
  return json;
}

/** Finish the OAuth dance and store (or refresh) the account. */
export async function connectAccount(db: DB, userId: string, code: string, redirectUri: string) {
  const { id, secret } = client();
  const t = await tokenRequest({
    code,
    client_id: id,
    client_secret: secret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  if (!t.id_token) throw new AppError("Google didn't return an identity token.");
  // The id_token came straight from Google over TLS, so reading its payload is enough here.
  const claims = JSON.parse(Buffer.from(t.id_token.split(".")[1], "base64url").toString("utf8"));
  const email = String(claims.email ?? "").toLowerCase();
  if (!email) throw new AppError("Google account has no email.");

  const { data: existing } = await db
    .from("google_accounts")
    .select("id, refresh_token_enc")
    .eq("user_id", userId)
    .eq("email", email)
    .maybeSingle();
  const refresh = t.refresh_token ? encrypt(t.refresh_token) : existing?.refresh_token_enc;
  if (!refresh) throw new AppError("Google didn't return a refresh token. Remove the app's access in your Google account and connect again.");

  return must(
    await db
      .from("google_accounts")
      .upsert(
        {
          user_id: userId,
          email,
          refresh_token_enc: refresh,
          access_token_enc: encrypt(t.access_token),
          access_expires_at: new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString(),
        },
        { onConflict: "user_id,email" },
      )
      .select("id, email")
      .single(),
    "save google account",
  );
}

/** A valid access token for the account, refreshing it if needed. */
export async function accessToken(db: DB, account: GoogleAccount): Promise<string> {
  if (account.access_token_enc && account.access_expires_at && new Date(account.access_expires_at) > new Date()) {
    return decrypt(account.access_token_enc);
  }
  const { id, secret } = client();
  let t: TokenResponse;
  try {
    t = await tokenRequest({
      client_id: id,
      client_secret: secret,
      refresh_token: decrypt(account.refresh_token_enc),
      grant_type: "refresh_token",
    });
  } catch (e) {
    if (e instanceof AppError && e.message.includes("invalid_grant")) {
      throw new AppError(`Google access for ${account.email} was revoked. Reconnect it in Settings.`, "unauthorized");
    }
    throw e;
  }
  const expires = new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString();
  await db
    .from("google_accounts")
    .update({ access_token_enc: encrypt(t.access_token), access_expires_at: expires })
    .eq("id", account.id);
  account.access_token_enc = null; // force callers to use the returned token
  return t.access_token;
}

export async function listAccounts(db: DB, userId: string): Promise<GoogleAccount[]> {
  return must(await db.from("google_accounts").select().eq("user_id", userId).order("created_at"), "google accounts");
}

export async function disconnectAccount(db: DB, userId: string, accountId: string) {
  const { data } = await db.from("google_accounts").select().eq("id", accountId).eq("user_id", userId).maybeSingle();
  if (!data) return;
  // Best effort: revoke at Google, then forget locally.
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(data.refresh_token_enc))}`, {
      method: "POST",
    });
  } catch {}
  await db.from("google_accounts").delete().eq("id", accountId);
}

export async function setCalendars(
  db: DB,
  userId: string,
  accountId: string,
  patch: { calendar_ids?: string[]; default_calendar_id?: string },
) {
  await db.from("google_accounts").update(patch).eq("id", accountId).eq("user_id", userId);
}
