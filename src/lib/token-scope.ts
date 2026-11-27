// What each kind of bearer token may reach. Pure, so tests can pin it down.
//
// - full: MCP, the capture endpoint and the whole app API. Every token made
//   before scopes existed is full.
// - app:  what the iPhone and Mac apps hold. The app API and capture, but not
//   MCP, so a token on a lost phone can't rewrite the account.

export type TokenScope = "full" | "app";

export const TOKEN_SCOPES: readonly TokenScope[] = ["full", "app"];

export type Surface = "mcp" | "capture" | "app";

const REACH: Record<TokenScope, readonly Surface[]> = {
  full: ["mcp", "capture", "app"],
  app: ["capture", "app"],
};

export function scopeAllows(scope: TokenScope, surface: Surface): boolean {
  return REACH[scope].includes(surface);
}

export function scopesFor(surface: Surface): TokenScope[] {
  return TOKEN_SCOPES.filter((s) => scopeAllows(s, surface));
}
