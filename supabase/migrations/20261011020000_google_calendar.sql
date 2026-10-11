-- Google Calendar: encrypted OAuth tokens per connected account, and an action
-- log that can reference non-uuid entities (Google event ids).

create table public.google_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  email text not null,
  refresh_token_enc text not null,
  access_token_enc text,
  access_expires_at timestamptz,
  -- Calendars shown on the dashboard; empty means just the primary calendar.
  calendar_ids text[] not null default '{}',
  -- Where new events go by default.
  default_calendar_id text not null default 'primary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, email)
);

create trigger google_accounts_touch before update on public.google_accounts
  for each row execute function public.touch_updated_at();

-- Tokens are server-only: RLS on, no client policies.
alter table public.google_accounts enable row level security;

alter table public.actions alter column entity_id type text using entity_id::text;
