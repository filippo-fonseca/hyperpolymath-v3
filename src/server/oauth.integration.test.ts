// OAuth authorization server against a real Supabase project (runs only when
// .env.local has the secret key, like integration.test.ts). Walks the whole
// lifecycle: register, approve, exchange, use, refresh, replay, revoke.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { adminDb } from "./ctx";
import {
  OAuthError,
  createCode,
  exchangeCode,
  listGrants,
  refreshTokens,
  registerClient,
  resolveClient,
  revokeByToken,
  revokeGrant,
  verifyAccessToken,
} from "./oauth";
import { checkAuthorize } from "./oauth-authorize";

const enabled = !!(process.env.SUPABASE_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);
const ISS = "https://hpm.test";
const RESOURCE = `${ISS}/api/mcp`;
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

const pkce = () => {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
};

const rejects = async (p: Promise<unknown>, error: OAuthError["error"]) => {
  await expect(p).rejects.toBeInstanceOf(OAuthError);
  await expect(p).rejects.toMatchObject({ error });
};

describe.skipIf(!enabled)("oauth (live DB)", () => {
  let userId = "";
  const db = () => adminDb();

  beforeAll(async () => {
    const { data, error } = await adminDb().auth.admin.createUser({ email: `oauth-${randomUUID()}@example.com`, email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
  });
  afterAll(async () => {
    if (userId) await adminDb().auth.admin.deleteUser(userId);
  });

  async function approve(clientId: string, p = pkce()) {
    const client = await resolveClient(db(), clientId);
    const code = await createCode(db(), { userId, client, redirectUri: REDIRECT, codeChallenge: p.challenge, scope: "mcp offline_access", resource: RESOURCE });
    return { code, ...p };
  }

  it("registers a public client and validates authorize requests", async () => {
    const reg = await registerClient(db(), { client_name: "Claude", redirect_uris: [REDIRECT], token_endpoint_auth_method: "client_secret_basic" });
    expect(reg.client_id).toMatch(/^hpc_/);
    expect(reg.token_endpoint_auth_method).toBe("none");

    const p = pkce();
    const base = { response_type: "code", client_id: reg.client_id, redirect_uri: REDIRECT, code_challenge: p.challenge, code_challenge_method: "S256", state: "xyz" };
    const ok = await checkAuthorize(db(), base, ISS);
    expect(ok.kind).toBe("ok");
    if (ok.kind === "ok") expect(ok.scope).toBe("mcp");

    // Unknown client or wrong redirect: shown on our page, never redirected.
    expect((await checkAuthorize(db(), { ...base, client_id: "hpc_nope" }, ISS)).kind).toBe("fatal");
    expect((await checkAuthorize(db(), { ...base, redirect_uri: "https://evil.example.com/cb" }, ISS)).kind).toBe("fatal");

    // Bad PKCE or resource: redirected back with an error, state and iss.
    const noPkce = await checkAuthorize(db(), { ...base, code_challenge: undefined }, ISS);
    expect(noPkce.kind).toBe("redirect");
    if (noPkce.kind === "redirect") {
      const u = new URL(noPkce.url);
      expect(u.searchParams.get("error")).toBe("invalid_request");
      expect(u.searchParams.get("state")).toBe("xyz");
      expect(u.searchParams.get("iss")).toBe(ISS);
    }
    const otherResource = await checkAuthorize(db(), { ...base, resource: "https://other.example.com/mcp" }, ISS);
    expect(otherResource.kind === "redirect" && new URL(otherResource.url).searchParams.get("error")).toBe("invalid_target");
  });

  it("exchanges a code once, then tokens work, refresh rotates and revoke disconnects", async () => {
    const reg = await registerClient(db(), { client_name: "ChatGPT", redirect_uris: [REDIRECT] });
    const a = await approve(reg.client_id);

    await rejects(exchangeCode(db(), { code: a.code, clientId: reg.client_id, redirectUri: REDIRECT, codeVerifier: pkce().verifier, resource: null }), "invalid_grant");
    await rejects(exchangeCode(db(), { code: a.code, clientId: "hpc_other", redirectUri: REDIRECT, codeVerifier: a.verifier, resource: null }), "invalid_grant");

    const t = await exchangeCode(db(), { code: a.code, clientId: reg.client_id, redirectUri: REDIRECT, codeVerifier: a.verifier, resource: RESOURCE });
    expect(t.access_token).toMatch(/^hpo_/);
    expect(t.refresh_token).toMatch(/^hpr_/);
    expect(t.scope).toBe("mcp offline_access");

    const who = await verifyAccessToken(db(), t.access_token, RESOURCE);
    expect(who?.userId).toBe(userId);
    expect(who?.clientName).toBe("ChatGPT");
    // Audience-bound: useless against another deployment's MCP URL.
    expect(await verifyAccessToken(db(), t.access_token, "https://other.test/api/mcp")).toBeNull();

    const apps = await listGrants(db(), userId);
    expect(apps.map((g) => g.name)).toContain("ChatGPT");

    const t2 = await refreshTokens(db(), { refreshToken: t.refresh_token, clientId: reg.client_id });
    expect(t2.refresh_token).not.toBe(t.refresh_token);
    expect(await verifyAccessToken(db(), t2.access_token, RESOURCE)).not.toBeNull();
    // The spent refresh token can't be used again.
    await rejects(refreshTokens(db(), { refreshToken: t.refresh_token, clientId: reg.client_id }), "invalid_grant");

    await revokeByToken(db(), t2.refresh_token);
    expect(await verifyAccessToken(db(), t2.access_token, RESOURCE)).toBeNull();
    await rejects(refreshTokens(db(), { refreshToken: t2.refresh_token, clientId: null }), "invalid_grant");
  });

  it("revokes everything a replayed code minted", async () => {
    const reg = await registerClient(db(), { client_name: "Replay", redirect_uris: [REDIRECT] });
    const a = await approve(reg.client_id);
    const input = { code: a.code, clientId: reg.client_id, redirectUri: REDIRECT, codeVerifier: a.verifier, resource: null };
    const t = await exchangeCode(db(), input);
    await rejects(exchangeCode(db(), input), "invalid_grant");
    expect(await verifyAccessToken(db(), t.access_token, RESOURCE)).toBeNull();
  });

  it("detects refresh token reuse after the retry grace and kills the grant", async () => {
    const reg = await registerClient(db(), { client_name: "Reuse", redirect_uris: [REDIRECT] });
    const a = await approve(reg.client_id);
    const t = await exchangeCode(db(), { code: a.code, clientId: reg.client_id, redirectUri: REDIRECT, codeVerifier: a.verifier, resource: null });
    const t2 = await refreshTokens(db(), { refreshToken: t.refresh_token, clientId: null });
    // Pretend the first refresh happened a minute ago, then replay it.
    const hash = createHash("sha256").update(t.refresh_token).digest("hex");
    await db().from("oauth_tokens").update({ used_at: new Date(Date.now() - 60_000).toISOString() }).eq("token_hash", hash);
    await rejects(refreshTokens(db(), { refreshToken: t.refresh_token, clientId: null }), "invalid_grant");
    expect(await verifyAccessToken(db(), t2.access_token, RESOURCE)).toBeNull();
  });

  it("disconnects from Settings, scoped to the owner", async () => {
    const reg = await registerClient(db(), { client_name: "Settings", redirect_uris: [REDIRECT] });
    const a = await approve(reg.client_id);
    const t = await exchangeCode(db(), { code: a.code, clientId: reg.client_id, redirectUri: REDIRECT, codeVerifier: a.verifier, resource: null });
    const grant = (await listGrants(db(), userId)).find((g) => g.name === "Settings")!;
    await revokeGrant(db(), randomUUID(), grant.id); // someone else's account: no effect
    expect(await verifyAccessToken(db(), t.access_token, RESOURCE)).not.toBeNull();
    await revokeGrant(db(), userId, grant.id);
    expect(await verifyAccessToken(db(), t.access_token, RESOURCE)).toBeNull();
    expect((await listGrants(db(), userId)).some((g) => g.id === grant.id)).toBe(false);
  });

  it("refuses CIMD URLs that point inside a network", async () => {
    await rejects(resolveClient(db(), "https://127.0.0.1/client.json"), "invalid_client");
    await rejects(resolveClient(db(), "http://chatgpt.com/oauth/client.json"), "invalid_client");
  });
});
