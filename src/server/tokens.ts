import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { must, type DB } from "./ctx";
import { type TokenScope } from "@/lib/token-scope";

// Bearer tokens for MCP, the capture endpoint and the app API. Only the
// SHA-256 hash is stored; the plaintext is shown once at creation. See
// `src/lib/token-scope.ts` for what each scope may reach.

export type { TokenScope };

const PREFIX = "hpm_";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function mintToken(db: DB, userId: string, name: string, scope: TokenScope = "full") {
  const fallback = scope === "app" ? "Apple device" : "Grok Bot";
  const token = PREFIX + randomBytes(24).toString("base64url");
  const row = must(
    await db
      .from("mcp_tokens")
      .insert({ user_id: userId, name: name.trim() || fallback, token_hash: hash(token), prefix: token.slice(0, 10), scope })
      .select("id, name, prefix, scope, created_at")
      .single(),
    "mint token",
  );
  return { ...row, token };
}

export async function listTokens(db: DB, userId: string) {
  return must(
    await db
      .from("mcp_tokens")
      .select("id, name, prefix, scope, created_at, last_used_at, revoked_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    "list tokens",
  );
}

export async function revokeToken(db: DB, userId: string, id: string) {
  await db.from("mcp_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
}

export type VerifiedToken = { userId: string; tokenId: string; name: string; scope: TokenScope };

/** Resolve a bearer token to its user and scope, or null when unknown or revoked. */
export async function resolveToken(db: DB, token: string): Promise<VerifiedToken | null> {
  if (!token.startsWith(PREFIX)) return null;
  const { data } = await db
    .from("mcp_tokens")
    .select("id, user_id, name, scope")
    .eq("token_hash", hash(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return null;
  void db.from("mcp_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
  return { userId: data.user_id, tokenId: data.id, name: data.name, scope: data.scope === "app" ? "app" : "full" };
}

/**
 * Resolve a bearer token to its user, or null. Only full tokens pass unless
 * `allow` names more scopes, so app tokens can't reach the MCP server.
 */
export async function verifyToken(db: DB, token: string, allow: TokenScope[] = ["full"]): Promise<string | null> {
  const found = await resolveToken(db, token);
  return found && allow.includes(found.scope) ? found.userId : null;
}
