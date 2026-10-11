import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { must, type DB } from "./ctx";

// MCP bearer tokens. Only the SHA-256 hash is stored; the plaintext is shown
// once at creation.

const PREFIX = "hpm_";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function mintToken(db: DB, userId: string, name: string) {
  const token = PREFIX + randomBytes(24).toString("base64url");
  const row = must(
    await db
      .from("mcp_tokens")
      .insert({ user_id: userId, name: name.trim() || "Grok Bot", token_hash: hash(token), prefix: token.slice(0, 10) })
      .select("id, name, prefix, created_at")
      .single(),
    "mint token",
  );
  return { ...row, token };
}

export async function listTokens(db: DB, userId: string) {
  return must(
    await db
      .from("mcp_tokens")
      .select("id, name, prefix, created_at, last_used_at, revoked_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    "list tokens",
  );
}

export async function revokeToken(db: DB, userId: string, id: string) {
  await db.from("mcp_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
}

/** Resolve a bearer token to its user, or null. */
export async function verifyToken(db: DB, token: string): Promise<string | null> {
  if (!token.startsWith(PREFIX)) return null;
  const { data } = await db
    .from("mcp_tokens")
    .select("id, user_id")
    .eq("token_hash", hash(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return null;
  void db.from("mcp_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
  return data.user_id;
}
