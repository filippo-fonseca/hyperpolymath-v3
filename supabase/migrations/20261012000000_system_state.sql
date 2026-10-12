-- Server-only key/value state, e.g. the reminder tick's heartbeat for the
-- Settings health view. RLS on with no policies: never exposed to clients.
create table public.system_state (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.system_state enable row level security;
