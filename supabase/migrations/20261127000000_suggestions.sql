-- Suggestions: tasks and captures a bot noticed on its own (an email deadline,
-- an idea from a chat) and proposes instead of creating. They wait in the
-- dashboard's Suggested tray until the owner accepts (which creates the real
-- task or capture) or dismisses them. Same rules as every other table: the
-- owner reads their rows through RLS (for Realtime), only the server writes.

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('task', 'capture')),
  -- The task title, or the capture's text.
  content text not null check (length(content) between 1 and 2000),
  notes text check (length(notes) <= 4000),
  -- Why the bot suggests it, and where it saw it ("Slack #mech-e, from Prof. Lee").
  reason text check (length(reason) <= 500),
  project_id uuid references public.projects (id) on delete set null,
  due_date date,
  due_time time,
  priority smallint not null default 0 check (priority between 0 and 3),
  -- Who suggested it: the bot's name (or an /api/suggest source), and the bot row.
  source text not null default 'bot' check (length(source) between 1 and 60),
  bot_id uuid references public.bots (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  resolved_at timestamptz,
  -- The task or capture an accepted suggestion became.
  result_id uuid,
  -- Normalised content, so the same thing isn't suggested twice.
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index suggestions_pending_idx on public.suggestions (user_id, created_at desc)
  where status = 'pending' and deleted_at is null;
create index suggestions_dedupe_idx on public.suggestions (user_id, kind, dedupe_key);
create index suggestions_source_recent_idx on public.suggestions (user_id, source, created_at desc);
create index suggestions_bot_idx on public.suggestions (bot_id) where bot_id is not null;
create index suggestions_project_idx on public.suggestions (project_id) where project_id is not null;

create trigger suggestions_touch before update on public.suggestions
  for each row execute function public.touch_updated_at();

alter table public.suggestions enable row level security;
create policy suggestions_owner_read on public.suggestions
  for select to authenticated using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.suggestions;
