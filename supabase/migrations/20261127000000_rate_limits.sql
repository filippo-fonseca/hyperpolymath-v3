-- Rate limits for the token endpoints (/api/mcp, /api/capture).
-- A fixed-window counter per key (for example "mcp:<user id>"), shared by every
-- serverless instance because it lives in Postgres. The table is unlogged: the
-- counters are throwaway, so skipping the WAL keeps each hit cheap, and losing
-- them on a crash just resets everyone's window.

create unlogged table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);

-- Nobody reads this through the API; the server calls rate_limit_hit with the
-- secret key. RLS on with no policies keeps anon and authenticated out.
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Count one hit for `p_key` in the current `p_window_seconds` window and return
-- the hit count so far in that window (1 for the first). The app compares it
-- with the limit, so limits can change without a migration.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds integer)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, w, 1)
  on conflict (key) do update
    set hits = case when r.window_start = excluded.window_start then r.hits + 1 else 1 end,
        window_start = excluded.window_start
  returning r.hits into n;
  return n;
end
$$;
revoke all on function public.rate_limit_hit(text, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer) to service_role;
