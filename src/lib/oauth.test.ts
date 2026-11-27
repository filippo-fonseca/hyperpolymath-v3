import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  authServerMetadata,
  bearerChallenge,
  grantedScope,
  isAllowedRedirectUri,
  isCimdUrl,
  isPkceChallenge,
  isPrivateIp,
  knownClient,
  matchResource,
  parseClientMetadata,
  protectedResourceMetadata,
  redirectLabel,
  redirectMatches,
  verifyPkce,
  withParams,
} from "./oauth";

const O = "https://hpm.example.org";

describe("metadata", () => {
  it("points the MCP resource at this origin's authorization server", () => {
    const pr = protectedResourceMetadata(O);
    expect(pr.resource).toBe(`${O}/api/mcp`);
    expect(pr.authorization_servers).toEqual([O]);
  });

  it("advertises what Claude and ChatGPT require", () => {
    const as = authServerMetadata(O);
    expect(as.issuer).toBe(O);
    expect(as.code_challenge_methods_supported).toEqual(["S256"]);
    // Claude only uses CIMD when both of these are present.
    expect(as.client_id_metadata_document_supported).toBe(true);
    expect(as.token_endpoint_auth_methods_supported).toContain("none");
    // ChatGPT uses its stable redirect when iss is returned (RFC 9207).
    expect(as.authorization_response_iss_parameter_supported).toBe(true);
    expect(as.scopes_supported).toContain("offline_access");
  });

  it("challenges with the path-suffixed resource metadata URL", () => {
    expect(bearerChallenge(O)).toBe(`Bearer resource_metadata="${O}/.well-known/oauth-protected-resource/api/mcp", scope="mcp"`);
    expect(bearerChallenge(O, "invalid_token")).toContain('error="invalid_token"');
  });
});

describe("PKCE", () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  it("accepts the matching verifier (RFC 7636 appendix B)", () => {
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    expect(verifyPkce(verifier, challenge)).toBe(true);
  });

  it("rejects a wrong or malformed verifier", () => {
    expect(verifyPkce(verifier.slice(0, -1) + "Y", challenge)).toBe(false);
    expect(verifyPkce("short", challenge)).toBe(false);
    expect(verifyPkce(verifier + " ", challenge)).toBe(false);
  });

  it("only takes S256-shaped challenges", () => {
    expect(isPkceChallenge(challenge)).toBe(true);
    expect(isPkceChallenge("plain-text-challenge")).toBe(false);
  });
});

describe("scopes and resources", () => {
  it("always grants mcp, keeps offline_access, drops the rest", () => {
    expect(grantedScope(undefined)).toBe("mcp");
    expect(grantedScope("openid email")).toBe("mcp");
    expect(grantedScope("mcp offline_access")).toBe("mcp offline_access");
  });

  it("matches the MCP URL with or without a trailing slash, or the bare origin", () => {
    expect(matchResource(undefined, O)).toBe(`${O}/api/mcp`);
    expect(matchResource(`${O}/api/mcp`, O)).toBe(`${O}/api/mcp`);
    expect(matchResource(`${O}/api/mcp/`, O)).toBe(`${O}/api/mcp`);
    expect(matchResource(O, O)).toBe(`${O}/api/mcp`);
  });

  it("refuses other servers' resources", () => {
    expect(matchResource("https://evil.example.com/api/mcp", O)).toBeNull();
    expect(matchResource(`${O}/api/capture`, O)).toBeNull();
    expect(matchResource("not a url", O)).toBeNull();
  });
});

describe("redirect URIs", () => {
  it("allows https, loopback http and app schemes", () => {
    expect(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(isAllowedRedirectUri("https://chatgpt.com/connector_platform_oauth_redirect")).toBe(true);
    expect(isAllowedRedirectUri("http://localhost:8787/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1/callback")).toBe(true);
    expect(isAllowedRedirectUri("cursor://anysphere.cursor-mcp/oauth/callback")).toBe(true);
  });

  it("refuses dangerous or sloppy ones", () => {
    expect(isAllowedRedirectUri("http://example.com/cb")).toBe(false);
    expect(isAllowedRedirectUri("javascript:alert(1)")).toBe(false);
    expect(isAllowedRedirectUri("data:text/html,hi")).toBe(false);
    expect(isAllowedRedirectUri("https://claude.ai/cb#frag")).toBe(false);
    expect(isAllowedRedirectUri("https://user:pw@claude.ai/cb")).toBe(false);
    expect(isAllowedRedirectUri("/relative")).toBe(false);
  });

  it("matches exactly, except loopback ports (RFC 8252)", () => {
    const reg = ["https://claude.ai/api/mcp/auth_callback", "http://localhost/callback", "http://127.0.0.1/callback"];
    expect(redirectMatches("https://claude.ai/api/mcp/auth_callback", reg)).toBe(true);
    expect(redirectMatches("http://localhost:3118/callback", reg)).toBe(true);
    expect(redirectMatches("http://127.0.0.1:50123/callback", reg)).toBe(true);
    expect(redirectMatches("http://localhost:3118/other", reg)).toBe(false);
    expect(redirectMatches("https://claude.ai/api/mcp/auth_callback?x=1", reg)).toBe(false);
    expect(redirectMatches("https://claude.ai.evil.com/api/mcp/auth_callback", reg)).toBe(false);
  });

  it("labels where the person is sent back to", () => {
    expect(redirectLabel("https://www.claude.ai/x")).toBe("claude.ai");
    expect(redirectLabel("http://localhost:9/x")).toBe("an app on this computer");
    expect(redirectLabel("cursor://anysphere.cursor-mcp/x")).toBe("the cursor app");
  });

  it("adds code, state and iss to the return URL", () => {
    const u = new URL(withParams("https://claude.ai/cb?keep=1", { code: "abc", state: "s t", iss: O, empty: "" }));
    expect(u.searchParams.get("keep")).toBe("1");
    expect(u.searchParams.get("code")).toBe("abc");
    expect(u.searchParams.get("state")).toBe("s t");
    expect(u.searchParams.get("iss")).toBe(O);
    expect(u.searchParams.has("empty")).toBe(false);
  });
});

describe("client metadata", () => {
  it("accepts a DCR body and fills a name", () => {
    const r = parseClientMetadata({ redirect_uris: ["https://claude.ai/api/mcp/auth_callback"], client_name: "Claude" });
    expect(r.ok && r.value.name).toBe("Claude");
    const unnamed = parseClientMetadata({ redirect_uris: ["https://chatgpt.com/connector_platform_oauth_redirect"] });
    expect(unnamed.ok && unnamed.value.name).toBe("chatgpt.com");
  });

  it("rejects missing or bad redirect URIs", () => {
    expect(parseClientMetadata({}).ok).toBe(false);
    expect(parseClientMetadata({ redirect_uris: [] }).ok).toBe(false);
    const bad = parseClientMetadata({ redirect_uris: ["http://evil.com/cb"] });
    expect(!bad.ok && bad.field).toBe("redirect_uri");
  });

  it("requires a CIMD document's client_id to be its own URL", () => {
    const url = "https://claude.ai/oauth/claude-code-client-metadata";
    expect(parseClientMetadata({ client_id: url, redirect_uris: ["http://localhost/callback"] }, { clientId: url }).ok).toBe(true);
    expect(parseClientMetadata({ client_id: "https://evil.com/x", redirect_uris: ["http://localhost/callback"] }, { clientId: url }).ok).toBe(false);
  });

  it("accepts Claude Code's published metadata document as served", () => {
    const url = "https://claude.ai/oauth/claude-code-client-metadata";
    const doc = {
      client_id: url,
      client_name: "Claude Code",
      client_uri: "https://claude.ai",
      redirect_uris: ["http://localhost/callback", "http://127.0.0.1/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
    const r = parseClientMetadata(doc, { clientId: url });
    expect(r.ok && r.value.name).toBe("Claude Code");
    // Claude Code picks a free port at sign-in time.
    expect(r.ok && redirectMatches("http://localhost:54012/callback", r.value.redirect_uris)).toBe(true);
  });

  it("drops non-https logos", () => {
    const r = parseClientMetadata({ redirect_uris: ["https://a.example.com/cb"], logo_uri: "http://a.example.com/logo.png" });
    expect(r.ok && r.value.logo_uri).toBeNull();
  });

  it("recognises the big three", () => {
    expect(knownClient("Claude", [])).toBe("claude");
    expect(knownClient("x", ["https://chatgpt.com/connector_platform_oauth_redirect"])).toBe("chatgpt");
    expect(knownClient("x", ["cursor://anysphere.cursor-mcp/oauth/callback"])).toBe("grok");
    expect(knownClient("My script", ["http://localhost/cb"])).toBeNull();
  });
});

describe("CIMD fetch guards", () => {
  it("only fetches public https documents", () => {
    expect(isCimdUrl("https://chatgpt.com/oauth/client.json")).toBe(true);
    expect(isCimdUrl("https://cursor.com/oauth/mcp-client.json")).toBe(true);
    expect(isCimdUrl("http://chatgpt.com/oauth/client.json")).toBe(false);
    expect(isCimdUrl("https://chatgpt.com/")).toBe(false);
    expect(isCimdUrl("https://127.0.0.1/client.json")).toBe(false);
    expect(isCimdUrl("https://metadata.internal/client.json")).toBe(false);
    expect(isCimdUrl("https://localhost/client.json")).toBe(false);
    expect(isCimdUrl("https://example.com:8443/client.json")).toBe(false);
  });

  it("spots private and link-local addresses", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.5.4", "192.168.1.1", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:10.1.2.3"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
    for (const ip of ["104.18.32.7", "160.79.104.10", "2606:4700::6810:84e5"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
});
