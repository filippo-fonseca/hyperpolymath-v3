-- Replies on captures, from you or a bot. Same rules as every other table:
-- the owner can read their rows through RLS (for Realtime), only the server
-- writes. Deletes are soft so the activity log can bring a reply back.

create table public.capture_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  capture_id uuid not null references public.captures (id) on delete cascade,
  content text not null check (length(content) between 1 and 5000),
  author_kind text not null check (author_kind in ('user', 'bot')),
  bot_id uuid references public.bots (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index capture_comments_capture_idx on public.capture_comments (capture_id, created_at)
  where deleted_at is null;
create index capture_comments_user_idx on public.capture_comments (user_id);
create index capture_comments_bot_idx on public.capture_comments (bot_id) where bot_id is not null;

create trigger capture_comments_touch before update on public.capture_comments
  for each row execute function public.touch_updated_at();

alter table public.capture_comments enable row level security;
create policy capture_comments_owner_read on public.capture_comments
  for select to authenticated using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.capture_comments;
