-- Reminder tick gate: pg_cron still runs every 5 minutes, but only calls the
-- app when there is something it can deliver. Reminders held back because
-- their account has no relay carry last_error = the no-relay message (see
-- NO_RELAY_ERROR in src/server/relay.ts), so they don't wake the app; saving a
-- relay clears that mark. Once an hour (minute 0) the tick runs regardless, so
-- recurring-task catch-up and anything the gate can't see still happen.
-- Before this, a stuck reminder made every 5-minute call fail and burned
-- Vercel function CPU around the clock.

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
  where u.name = 'tick_url'
    and (
      extract(minute from now()) < 5
      or exists (
        select 1 from public.reminders r
        where r.active and r.next_fire_at <= now()
          and r.last_error is distinct from 'No reminder relay set up. Add the Reminder relay webhook in Settings, Reminders.'
      )
      or exists (
        select 1 from public.captures c
        where c.resurface_next_at <= now() and c.deleted_at is null and c.archived_at is null
      )
    );
  $job$
);
