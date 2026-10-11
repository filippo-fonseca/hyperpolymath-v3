-- Bots can be retired from the teammates view without losing their history.
alter table public.bots add column archived_at timestamptz;
