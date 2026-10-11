-- Hyperpolymath v3 initial schema.
-- Every row belongs to a user (user_id). The browser only reads through RLS
-- (for Realtime); all writes go through the server service layer, which uses
-- the secret key and scopes by user_id explicitly.

create extension if not exists pgcrypto;

-- updated_at helper ---------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- settings ------------------------------------------------------------------
create table public.settings (
  user_id uuid primary key references auth.users on delete cascade,
  timezone text not null default 'America/New_York',
  updated_at timestamptz not null default now()
);

-- bots (Grok Bot teammates) -------------------------------------------------
create table public.bots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  role text,
  description text,
  parent_id uuid references public.bots (id) on delete set null,
  is_coordinator boolean not null default false,
  avatar_shape text not null default 'blob',
  avatar_color text not null default 'blue',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index bots_user_name_idx on public.bots (user_id, lower(name));

-- tasks ---------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null check (length(title) between 1 and 500),
  notes text,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  priority smallint not null default 0 check (priority between 0 and 3),
  list text,
  due_date date,
  due_time time,
  recurrence jsonb,
  position double precision not null default 0,
  completed_at timestamptz,
  created_by text not null default 'you',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index tasks_user_open_idx on public.tasks (user_id, due_date)
  where deleted_at is null and status <> 'done';

-- reminders -----------------------------------------------------------------
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  message text,
  schedule jsonb not null,
  until_kind text not null default 'done' check (until_kind in ('done', 'date', 'count', 'once')),
  until_date date,
  remaining_count integer,
  next_fire_at timestamptz,
  last_fired_at timestamptz,
  fire_count integer not null default 0,
  active boolean not null default true,
  last_error text,
  created_by text not null default 'you',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (task_id is not null or message is not null)
);
create index reminders_due_idx on public.reminders (next_fire_at) where active;

-- habits --------------------------------------------------------------------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 120),
  icon text,
  -- Sunday = 0 ... Saturday = 6
  days_of_week smallint[] not null default '{0,1,2,3,4,5,6}',
  position double precision not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  date date not null,
  -- 0 = none, 1 = started, 2 = almost, 3 = done
  progress smallint not null check (progress between 0 and 3),
  updated_at timestamptz not null default now(),
  unique (habit_id, date)
);

-- captures ------------------------------------------------------------------
create table public.captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  content text not null check (length(content) between 1 and 20000),
  urls text[] not null default '{}',
  source text not null default 'you',
  resurface_at date,
  converted_task_id uuid references public.tasks (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index captures_user_recent_idx on public.captures (user_id, created_at desc)
  where deleted_at is null and archived_at is null;

-- widgets -------------------------------------------------------------------
create table public.widgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  -- fixed: tasks, calendar, habits, capture, kiwi. custom: digest, list, stat, timeline, markdown, table
  kind text not null check (kind in (
    'tasks', 'calendar', 'habits', 'capture', 'kiwi',
    'digest', 'list', 'stat', 'timeline', 'markdown', 'table'
  )),
  title text not null,
  owner_bot_id uuid references public.bots (id) on delete set null,
  payload jsonb not null default '{}',
  page smallint not null default 0,
  position double precision not null default 0,
  size text not null default 'm' check (size in ('s', 'm', 'l')),
  stale_after_hours integer,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.widget_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  widget_id uuid not null references public.widgets (id) on delete cascade,
  payload jsonb not null,
  bot_id uuid references public.bots (id) on delete set null,
  created_at timestamptz not null default now()
);
create index widget_snapshots_widget_idx on public.widget_snapshots (widget_id, created_at desc);

-- actions (audit log, drives activity view and revert) ----------------------
create table public.actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  actor_kind text not null check (actor_kind in ('user', 'bot', 'system')),
  bot_id uuid references public.bots (id) on delete set null,
  tool text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  summary text not null,
  created_at timestamptz not null default now(),
  reverted_at timestamptz,
  reverted_by uuid references public.actions (id) on delete set null
);
create index actions_user_recent_idx on public.actions (user_id, created_at desc);
create index actions_bot_idx on public.actions (bot_id, created_at desc);

-- MCP bearer tokens (server only; hashed) -----------------------------------
create table public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  token_hash text not null unique,
  prefix text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- triggers ------------------------------------------------------------------
create trigger settings_touch before update on public.settings for each row execute function public.touch_updated_at();
create trigger bots_touch before update on public.bots for each row execute function public.touch_updated_at();
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();
create trigger reminders_touch before update on public.reminders for each row execute function public.touch_updated_at();
create trigger habits_touch before update on public.habits for each row execute function public.touch_updated_at();
create trigger habit_logs_touch before update on public.habit_logs for each row execute function public.touch_updated_at();
create trigger captures_touch before update on public.captures for each row execute function public.touch_updated_at();
create trigger widgets_touch before update on public.widgets for each row execute function public.touch_updated_at();

-- RLS: owner can read their rows; no client writes (server uses secret key) ---
do $$
declare t text;
begin
  foreach t in array array[
    'settings', 'bots', 'tasks', 'reminders', 'habits', 'habit_logs',
    'captures', 'widgets', 'widget_snapshots', 'actions', 'mcp_tokens'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  foreach t in array array[
    'settings', 'bots', 'tasks', 'reminders', 'habits', 'habit_logs',
    'captures', 'widgets', 'widget_snapshots', 'actions'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t || '_owner_read', t
    );
  end loop;
end $$;

-- Realtime ------------------------------------------------------------------
alter publication supabase_realtime add table
  public.tasks, public.reminders, public.habits, public.habit_logs,
  public.captures, public.widgets, public.bots, public.actions;
