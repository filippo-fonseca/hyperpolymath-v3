import "server-only";
import { randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { must, type DB, type Row } from "./ctx";
import {
  ACCESS_TTL_S,
  CODE_TTL_S,
  REFRESH_TTL_S,
  isCimdUrl,
  isPrivateIp,
  parseClientMetadata,
  redirectMatches,
  sha256,
  verifyPkce,
} from "@/lib/oauth";

// Hyperpolymath's OAuth 2.1 authorization server, for MCP clients (Claude,
// ChatGPT, Grok Bot...). Public clients only, PKCE S256 required, opaque
// tokens stored as SHA-256 hashes. Route handlers in src/app/api/oauth/* and
// the consent page call these; nothing here trusts the request beyond what it
// validates. Pure helpers live in src/lib/oauth.ts.

export class OAuthError extends Error {
  constructor(
    public error:
      | "invalid_request"
      | "invalid_client"
      | "invalid_grant"
      | "unauthorized_client"
      | "unsupported_grant_type"
      | "invalid_scope"
      | "invalid_redirect_uri"
      | "invalid_client_metadata"
      | "access_denied"
      | "server_error",
    message: string,
    public status = 400,
  ) {
    super(message);
  }
  json() {
    return { error: this.error, error_description: this.message };
  }
}

export type OAuthClient = Row<"oauth_clients">;

const ACCESS_PREFIX = "hpo_";
const REFRESH_PREFIX = "hpr_";
const CODE_PREFIX = "hpa_";
const CLIENT_PREFIX = "hpc_";

const secret = (prefix: string) => prefix + randomBytes(32).toString("base64url");
const inSeconds = (s: number, now = Date.now()) => new Date(now + s * 1000).toISOString();

/* ---------------- clients ---------------- */

/** Dynamic client registration (RFC 7591). Everyone registers as a public client. */
export async function registerClient(db: DB, body: unknown) {
  const parsed = parseClientMetadata(body);
  if (!parsed.ok) {
    throw new OAuthError(parsed.field === "redirect_uri" ? "invalid_redirect_uri" : "invalid_client_metadata", parsed.error);
  }
  const m = parsed.value;
  const row = must(
    await db
      .from("oauth_clients")
      .insert({ client_id: secret(CLIENT_PREFIX), kind: "dcr", name: m.name, client_uri: m.client_uri, logo_uri: m.logo_uri, redirect_uris: m.redirect_uris })
      .select("*")
      .single(),
    "register client",
  );
  return {
    client_id: row.client_id,
    client_id_issued_at: Math.floor(new Date(row.created_at).getTime() / 1000),
    client_name: row.name,
    redirect_uris: row.redirect_uris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    ...(row.client_uri ? { client_uri: row.client_uri } : {}),
    ...(row.logo_uri ? { logo_uri: row.logo_uri } : {}),
  };
}

const CIMD_MAX_BYTES = 16 * 1024;
const CIMD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Fetch a Client ID Metadata Document, refusing anything that resolves to a private address. */
async function fetchCimd(url: string): Promise<unknown> {
  const host = new URL(url).hostname;
  const addrs = await lookup(host, { all: true }).catch(() => []);
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
    throw new OAuthError("invalid_client", "The client's metadata document host is not reachable.");
  }
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "error",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
  } catch {
    throw new OAuthError("invalid_client", "Couldn't fetch the client's metadata document.");
  }
  if (!res.ok) throw new OAuthError("invalid_client", `The client's metadata document returned HTTP ${res.status}.`);
  const reader = res.body?.getReader();
  if (!reader) throw new OAuthError("invalid_client", "The client's metadata document was empty.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > CIMD_MAX_BYTES) {
      void reader.cancel();
      throw new OAuthError("invalid_client", "The client's metadata document is too large.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new OAuthError("invalid_client", "The client's metadata document isn't valid JSON.");
  }
}

/**
 * Look up a client by `client_id`: a registered `hpc_...` id, or an https URL
 * naming a Client ID Metadata Document, which is fetched and cached for a day.
 */
export async function resolveClient(db: DB, clientId: string | null | undefined): Promise<OAuthClient> {
  if (!clientId || clientId.length > 500) throw new OAuthError("invalid_client", "Missing or invalid client_id.");
  const { data: existing } = await db.from("oauth_clients").select("*").eq("client_id", clientId).maybeSingle();

  if (clientId.startsWith(CLIENT_PREFIX)) {
    if (!existing) throw new OAuthError("invalid_client", "Unknown client. Register again.", 401);
    return existing;
  }
  if (!isCimdUrl(clientId)) throw new OAuthError("invalid_client", "Unknown client.", 401);

  if (existing?.fetched_at && Date.now() - new Date(existing.fetched_at).getTime() < CIMD_MAX_AGE_MS) return existing;

  let parsed: ReturnType<typeof parseClientMetadata>;
  try {
    parsed = parseClientMetadata(await fetchCimd(clientId), { clientId });
  } catch (e) {
    // A stale cached copy beats failing a sign-in because the document host blipped.
    if (existing) return existing;
    throw e;
  }
  if (!parsed.ok) throw new OAuthError("invalid_client", parsed.error);
  const m = parsed.value;
  const fields = { name: m.name, client_uri: m.client_uri, logo_uri: m.logo_uri, redirect_uris: m.redirect_uris, fetched_at: new Date().toISOString() };
  return must(
    await db
      .from("oauth_clients")
      .upsert({ client_id: clientId, kind: "cimd", ...fields }, { onConflict: "client_id" })
      .select("*")
      .single(),
    "save client",
  );
}

export function checkRedirect(client: OAuthClient, redirectUri: string | null | undefined): string {
  if (!redirectUri) {
    if (client.redirect_uris.length === 1) return client.redirect_uris[0];
    throw new OAuthError("invalid_request", "redirect_uri is required.");
  }
  if (!redirectMatches(redirectUri, client.redirect_uris)) {
    throw new OAuthError("invalid_request", "redirect_uri doesn't match any URI registered for this client.");
  }
  return redirectUri;
}

/* ---------------- authorization codes ---------------- */

export async function createCode(
  db: DB,
  input: { userId: string; client: OAuthClient; redirectUri: string; codeChallenge: string; scope: string; resource: string },
) {
  const code = secret(CODE_PREFIX);
  must(
    await db
      .from("oauth_codes")
      .insert({
        code_hash: sha256(code),
        user_id: input.userId,
        client_id: input.client.id,
        redirect_uri: input.redirectUri,
        code_challenge: input.codeChallenge,
        scope: input.scope,
        resource: input.resource,
        expires_at: inSeconds(CODE_TTL_S),
      })
      .select("code_hash")
      .single(),
    "create code",
  );
  return code;
}

/* ---------------- tokens ---------------- */

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

async function mintPair(db: DB, grantId: string, scope: string): Promise<TokenResponse> {
  const access = secret(ACCESS_PREFIX);
  const refresh = secret(REFRESH_PREFIX);
  const now = Date.now();
  must(
    await db
      .from("oauth_tokens")
      .insert([
        { grant_id: grantId, kind: "access", token_hash: sha256(access), expires_at: inSeconds(ACCESS_TTL_S, now) },
        { grant_id: grantId, kind: "refresh", token_hash: sha256(refresh), expires_at: inSeconds(REFRESH_TTL_S, now) },
      ])
      .select("id"),
    "mint tokens",
  );
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, scope };
}

async function revokeGrantById(db: DB, grantId: string) {
  await db.from("oauth_grants").update({ revoked_at: new Date().toISOString() }).eq("id", grantId).is("revoked_at", null);
  await db.from("oauth_tokens").delete().eq("grant_id", grantId);
}

/** authorization_code grant: swap a single-use code plus its PKCE verifier for tokens. */
export async function exchangeCode(
  db: DB,
  input: { code: string; clientId: string; redirectUri: string | null; codeVerifier: string; resource: string | null },
): Promise<TokenResponse> {
  if (!input.code || !input.codeVerifier) throw new OAuthError("invalid_request", "code and code_verifier are required.");
  const hash = sha256(input.code);
  const { data: code } = await db.from("oauth_codes").select("*, oauth_clients(*)").eq("code_hash", hash).maybeSingle();
  if (!code || !code.oauth_clients) throw new OAuthError("invalid_grant", "Unknown or expired authorization code.");

  if (code.used_at) {
    // Replay: whoever holds this code is not who it was issued to. Kill what it minted.
    if (code.grant_id) await revokeGrantById(db, code.grant_id);
    throw new OAuthError("invalid_grant", "Authorization code was already used.");
  }
  if (new Date(code.expires_at).getTime() < Date.now()) throw new OAuthError("invalid_grant", "Authorization code expired.");
  if (code.oauth_clients.client_id !== input.clientId) throw new OAuthError("invalid_grant", "Code was issued to a different client.");
  if ((input.redirectUri ?? code.redirect_uri) !== code.redirect_uri) throw new OAuthError("invalid_grant", "redirect_uri doesn't match.");
  if (input.resource && input.resource !== code.resource) throw new OAuthError("invalid_grant", "resource doesn't match the authorization request.");
  if (!verifyPkce(input.codeVerifier, code.code_challenge)) throw new OAuthError("invalid_grant", "PKCE verification failed.");

  // Claim the code atomically so two concurrent exchanges can't both win.
  const { data: claimed } = await db
    .from("oauth_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", hash)
    .is("used_at", null)
    .select("code_hash")
    .maybeSingle();
  if (!claimed) throw new OAuthError("invalid_grant", "Authorization code was already used.");

  const grant = must(
    await db
      .from("oauth_grants")
      .insert({ user_id: code.user_id, client_id: code.client_id, client_name: code.oauth_clients.name, scope: code.scope, resource: code.resource })
      .select("id")
      .single(),
    "create grant",
  );
  await db.from("oauth_codes").update({ grant_id: grant.id }).eq("code_hash", hash);
  return mintPair(db, grant.id, code.scope);
}

/** Refresh tokens are single use; presenting a spent one revokes the whole grant (reuse detection). */
const REFRESH_RETRY_GRACE_MS = 30_000;

export async function refreshTokens(db: DB, input: { refreshToken: string; clientId: string | null }): Promise<TokenResponse> {
  if (!input.refreshToken?.startsWith(REFRESH_PREFIX)) throw new OAuthError("invalid_grant", "Invalid refresh token.");
  const hash = sha256(input.refreshToken);
  const { data: tok } = await db
    .from("oauth_tokens")
    .select("*, oauth_grants(*, oauth_clients(client_id))")
    .eq("token_hash", hash)
    .eq("kind", "refresh")
    .maybeSingle();
  const grant = tok?.oauth_grants;
  if (!tok || !grant || grant.revoked_at) throw new OAuthError("invalid_grant", "Invalid refresh token.");
  if (input.clientId && grant.oauth_clients?.client_id !== input.clientId) throw new OAuthError("invalid_grant", "Refresh token was issued to a different client.");
  if (new Date(tok.expires_at).getTime() < Date.now()) throw new OAuthError("invalid_grant", "Refresh token expired. Sign in again.");

  if (tok.used_at) {
    // A quick retry after a dropped response is a client bug, not theft; anything later is reuse.
    if (Date.now() - new Date(tok.used_at).getTime() > REFRESH_RETRY_GRACE_MS) await revokeGrantById(db, grant.id);
    throw new OAuthError("invalid_grant", "Refresh token was already used.");
  }
  const { data: claimed } = await db
    .from("oauth_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tok.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) throw new OAuthError("invalid_grant", "Refresh token was already used.");
  return mintPair(db, grant.id, grant.scope);
}

/** Resolve an OAuth access token to its account, or null. `resource` is the MCP URL being called. */
export async function verifyAccessToken(db: DB, token: string, resource: string): Promise<{ userId: string; grantId: string; clientName: string } | null> {
  if (!token.startsWith(ACCESS_PREFIX)) return null;
  const { data } = await db
    .from("oauth_tokens")
    .select("expires_at, oauth_grants(id, user_id, client_name, resource, revoked_at, last_used_at)")
    .eq("token_hash", sha256(token))
    .eq("kind", "access")
    .maybeSingle();
  const grant = data?.oauth_grants;
  if (!data || !grant || grant.revoked_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  if (grant.resource !== resource) return null;
  // Bump last-used at most once a minute; fire and forget.
  if (!grant.last_used_at || Date.now() - new Date(grant.last_used_at).getTime() > 60_000) {
    void db.from("oauth_grants").update({ last_used_at: new Date().toISOString() }).eq("id", grant.id).then(() => {});
  }
  return { userId: grant.user_id, grantId: grant.id, clientName: grant.client_name };
}

/** RFC 7009: revoke the grant behind an access or refresh token. Unknown tokens are not an error. */
export async function revokeByToken(db: DB, token: string) {
  if (!token || !(token.startsWith(ACCESS_PREFIX) || token.startsWith(REFRESH_PREFIX))) return;
  const { data } = await db.from("oauth_tokens").select("grant_id").eq("token_hash", sha256(token)).maybeSingle();
  if (data) await revokeGrantById(db, data.grant_id);
}

/* ---------------- connected apps (Settings) ---------------- */

export type ConnectedApp = {
  id: string;
  name: string;
  client_uri: string | null;
  logo_uri: string | null;
  redirect_uris: string[];
  created_at: string;
  last_used_at: string | null;
};

/** Live grants for the Settings view. */
export async function listGrants(db: DB, userId: string): Promise<ConnectedApp[]> {
  const rows = must(
    await db
      .from("oauth_grants")
      .select("id, client_name, created_at, last_used_at, oauth_clients(client_uri, logo_uri, redirect_uris)")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
    "list connected apps",
  );
  return rows.map((g) => ({
    id: g.id,
    name: g.client_name,
    client_uri: g.oauth_clients?.client_uri ?? null,
    logo_uri: g.oauth_clients?.logo_uri ?? null,
    redirect_uris: g.oauth_clients?.redirect_uris ?? [],
    created_at: g.created_at,
    last_used_at: g.last_used_at,
  }));
}

export async function revokeGrant(db: DB, userId: string, grantId: string) {
  const { data } = await db.from("oauth_grants").select("id").eq("id", grantId).eq("user_id", userId).maybeSingle();
  if (data) await revokeGrantById(db, data.id);
}
