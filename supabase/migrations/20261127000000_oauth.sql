-- OAuth 2.1 for the MCP endpoint, so Claude, ChatGPT and Grok Bot can connect
-- with a sign-in screen instead of a pasted token. Hyperpolymath is its own
-- authorization server: clients register (RFC 7591) or identify themselves
-- with a Client ID Metadata Document URL, the owner approves on /oauth/authorize,
-- and the token endpoint swaps a PKCE code for short-lived access tokens plus a
-- rotating refresh token. Only SHA-256 hashes of codes and tokens are stored.
-- hpm_ tokens (mcp_tokens) keep working alongside.
--
-- Server-only tables: RLS is on with no policies, so only the secret key reads them.

create table public.oauth_clients (
  id uuid primary key default gen_random_uuid(),
  -- 'hpc_...' for registered clients, or the metadata document URL for CIMD.
  client_id text not null unique,
  kind text not null check (kind in ('dcr', 'cimd')),
  name text not null,
  client_uri text,
  logo_uri text,
  redirect_uris text[] not null,
  created_at timestamptz not null default now(),
  -- CIMD documents are re-fetched once this is a day old.
  fetched_at timestamptz
);

-- One approval of one client by one account. Revoking it kills every token.
create table public.oauth_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  client_id uuid not null references public.oauth_clients on delete cascade,
  client_name text not null,
  scope text not null,
  resource text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index oauth_grants_user on public.oauth_grants (user_id, created_at desc);

create table public.oauth_codes (
  code_hash text primary key,
  user_id uuid not null references auth.users on delete cascade,
  client_id uuid not null references public.oauth_clients on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  scope text not null,
  resource text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  -- Set on exchange, so a replayed code can revoke what it minted.
  grant_id uuid references public.oauth_grants on delete cascade
);

create table public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.oauth_grants on delete cascade,
  kind text not null check (kind in ('access', 'refresh')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  -- Refresh tokens are single use; a second use revokes the grant.
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index oauth_tokens_grant on public.oauth_tokens (grant_id);

alter table public.oauth_clients enable row level security;
alter table public.oauth_grants enable row level security;
alter table public.oauth_codes enable row level security;
alter table public.oauth_tokens enable row level security;

-- Housekeeping: drop expired codes and tokens, revoked grants after 30 days,
-- and registered clients nobody finished connecting within a day.
create or replace function public.oauth_gc() returns void
language sql
set search_path = ''
as $$
  delete from public.oauth_codes where expires_at < now() - interval '1 hour';
  delete from public.oauth_tokens where expires_at < now();
  delete from public.oauth_grants where revoked_at < now() - interval '30 days';
  delete from public.oauth_clients c
  where c.created_at < now() - interval '1 day'
    and not exists (select 1 from public.oauth_grants g where g.client_id = c.id)
    and not exists (select 1 from public.oauth_codes o where o.client_id = c.id);
$$;
revoke all on function public.oauth_gc() from public, anon, authenticated;
grant execute on function public.oauth_gc() to service_role;

select cron.schedule('hyperpolymath-oauth-gc', '17 4 * * *', 'select public.oauth_gc()');
