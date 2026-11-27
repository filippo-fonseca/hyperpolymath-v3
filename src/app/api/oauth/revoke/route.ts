import { adminDb } from "@/server/ctx";
import { revokeByToken } from "@/server/oauth";
import { json, oauthError, preflight, readParams } from "@/server/oauth-http";

// RFC 7009 token revocation. Revoking either token of a pair disconnects the
// app (the whole grant). Always 200, so it can't be used to probe tokens.

export async function POST(req: Request) {
  try {
    const params = await readParams(req);
    await revokeByToken(adminDb(), params.get("token") ?? "");
    return json({});
  } catch (e) {
    return oauthError(e);
  }
}

export const OPTIONS = preflight;
