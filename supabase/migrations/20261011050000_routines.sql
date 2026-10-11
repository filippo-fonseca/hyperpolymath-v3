-- Routines registry. Routines run in Grok Bot; bots register them here so the
-- app can list every bot's routines, link them to widgets, and switch them on
-- or off. Bots check in at the start of each run (start_routine_run) and skip
-- the run when the routine is disabled, so the app's toggle really controls it.

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  bot_id uuid not null references public.bots (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  description text,
  schedule text,
  enabled boolean not null default true,
  widget_id uuid references public.widgets (id) on delete set null,
  grokbot_routine_id text,
  last_run_at timestamptz,
  last_status text check (last_status in ('ok', 'error', 'skipped')),
  last_summary text,
  run_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index routines_bot_name_idx on public.routines (bot_id, lower(name)) where deleted_at is null;
create index routines_user_idx on public.routines (user_id) where deleted_at is null;

create table public.routine_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  routine_id uuid not null references public.routines (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'error', 'skipped')),
  summary text
);
create index routine_runs_routine_idx on public.routine_runs (routine_id, started_at desc);

create trigger routines_touch before update on public.routines for each row execute function public.touch_updated_at();

alter table public.routines enable row level security;
alter table public.routine_runs enable row level security;
create policy routines_owner_read on public.routines for select to authenticated using (user_id = (select auth.uid()));
create policy routine_runs_owner_read on public.routine_runs for select to authenticated using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.routines, public.routine_runs;
