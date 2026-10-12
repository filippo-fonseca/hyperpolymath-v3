-- Routines discovered from widget publishes (inferred) vs registered by a bot.
alter table public.routines add column source text not null default 'registered' check (source in ('registered', 'inferred'));
