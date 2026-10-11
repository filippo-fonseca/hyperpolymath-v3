-- Accounts can be switched off without disconnecting, and exactly one account
-- (with its default calendar) is where new events go.
alter table public.google_accounts
  add column enabled boolean not null default true,
  add column is_default boolean not null default false;

create unique index google_accounts_one_default_idx
  on public.google_accounts (user_id) where is_default;
