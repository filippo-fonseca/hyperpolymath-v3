-- Token scopes. A "full" token works everywhere (MCP, capture, the app API),
-- which is what every existing token keeps. An "app" token is what the iPhone
-- and Mac apps hold: it can read the app API, capture, tick tasks and log
-- habits, but it can't reach the MCP server. A lost phone then can't rewrite
-- the account; revoke the token and nothing else changes.

alter table public.mcp_tokens
  add column scope text not null default 'full' check (scope in ('full', 'app'));
