// The /oauth/authorize query params the consent form carries back to the
// server. Kept apart from src/lib/oauth.ts (which uses node:crypto) so the
// client component can import it.

export const AUTHORIZE_FIELDS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
  "state",
  "scope",
  "resource",
] as const;

export type AuthorizeParams = Partial<Record<(typeof AUTHORIZE_FIELDS)[number], string>>;
