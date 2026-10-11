-- Reminder tick: pg_cron calls the app's /api/cron/tick every 5 minutes.
-- The shared secret is generated here and lives only in Vault; the app checks
-- it through check_cron_secret (service role only), so no human handles it.
-- The tick URL is also kept in Vault and set after deploy:
--   select vault.create_secret('https://<app>/api/cron/tick', 'tick_url');

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_secret');
  end if;
end $$;

create or replace function public.check_cron_secret(presented text) returns boolean
language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'cron_secret' and decrypted_secret = presented
  );
$$;
revoke all on function public.check_cron_secret(text) from public, anon, authenticated;
grant execute on function public.check_cron_secret(text) to service_role;

select cron.schedule(
  'hyperpolymath-reminder-tick',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := u.decrypted_secret,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  )
  from vault.decrypted_secrets u
  where u.name = 'tick_url';
  $job$
);
