-- Open sign-up: anyone can create an account with email and password.
--
-- profiles: one row per account, kept in sync with auth.users by triggers, so
-- the app (and you, in the table editor) can see who has signed up. Every other
-- table already scopes rows by user_id; RLS lets a signed-in user read only
-- their own rows, and only the server (secret key) writes.
--
-- reminder_relays: each account's own Grok Bot "Reminder relay" webhook, so
-- one account's reminders are never delivered to another account's bot. The
-- token is encrypted by the server. RLS is on with no policies: server only.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);

alter table public.profiles enable row level security;
create policy profiles_owner_read on public.profiles for select to authenticated using (id = (select auth.uid()));

create or replace function public.sync_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, created_at, last_sign_in_at)
  values (new.id, coalesce(new.email, ''), new.created_at, new.last_sign_in_at)
  on conflict (id) do update
    set email = excluded.email, last_sign_in_at = excluded.last_sign_in_at;
  return new;
end $$;

revoke execute on function public.sync_profile() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.sync_profile();
create trigger on_auth_user_updated after update of email, last_sign_in_at on auth.users
  for each row execute function public.sync_profile();

insert into public.profiles (id, email, created_at, last_sign_in_at)
select id, coalesce(email, ''), created_at, last_sign_in_at from auth.users
on conflict (id) do nothing;

create table public.reminder_relays (
  user_id uuid primary key references auth.users on delete cascade,
  url text not null,
  token_enc text not null,
  updated_at timestamptz not null default now()
);

alter table public.reminder_relays enable row level security;
create trigger reminder_relays_touch before update on public.reminder_relays
  for each row execute function public.touch_updated_at();
