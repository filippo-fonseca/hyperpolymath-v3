-- Captures resurface on a schedule instead of a single date.
--
-- resurface_schedule: the same shape as reminder schedules (once, daily,
--   interval), see src/lib/schedule.ts.
-- resurface_next_at: when the tick next brings it back (null = not scheduled).
-- resurfaced_at: when it last came back; non-null means it sits in the
--   Resurfaced section until you mark it seen.
--
-- resurface_at (a plain date) stays for now because the running app still
-- reads it. Drop it in a later migration once this code is live.

alter table public.captures
  add column if not exists resurface_schedule jsonb,
  add column if not exists resurface_next_at timestamptz,
  add column if not exists resurfaced_at timestamptz;

create index if not exists captures_resurface_due_idx on public.captures (resurface_next_at)
  where resurface_next_at is not null and deleted_at is null and archived_at is null;
create index if not exists captures_resurfaced_idx on public.captures (user_id, resurfaced_at desc)
  where resurfaced_at is not null and deleted_at is null and archived_at is null;

-- Carry existing resurface dates over: once, at 09:00 in the owner's timezone.
-- A date already past lands straight in Resurfaced. Safe to rerun: rows that
-- already have a schedule are left alone.
with due as (
  select c.id,
         c.resurface_at,
         (c.resurface_at + time '09:00') at time zone coalesce(s.timezone, 'America/New_York') as at
  from public.captures c
  left join public.settings s on s.user_id = c.user_id
  where c.resurface_at is not null and c.resurface_schedule is null
)
update public.captures c
set resurface_schedule = jsonb_build_object('type', 'once', 'date', to_char(due.resurface_at, 'YYYY-MM-DD'), 'time', '09:00'),
    resurface_next_at = case when due.at > now() then due.at end,
    resurfaced_at = case when due.at <= now() then due.at end
from due
where c.id = due.id;
