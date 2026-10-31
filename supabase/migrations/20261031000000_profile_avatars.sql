-- Profile fields and an avatars bucket.
--
-- profiles gains a display name and an avatar URL, both written only by the
-- server (secret key), like every other table.
--
-- avatars: a public bucket so avatar URLs render without signed-URL round
-- trips. Objects live under `<user_id>/<file>`; signed-in users may only
-- write inside their own folder. The server uploads with the secret key, so
-- these policies are a second line of defence, not the main path. There is no
-- SELECT policy on purpose: public buckets serve files by URL without one,
-- and leaving it out stops anyone from listing every account's avatars.

alter table public.profiles
  add column if not exists display_name text check (display_name is null or length(display_name) between 1 and 80),
  add column if not exists avatar_url text check (avatar_url is null or length(avatar_url) <= 2000);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
