-- Saved view options for the task lists (sort, direction, grouping, filters),
-- one object per tab. The app parses it over its own defaults.
alter table public.settings add column task_view jsonb not null default '{}'::jsonb;
