# Deploying Hyperpolymath v3

Stack: Next.js on Vercel, Supabase (Postgres, Auth, Realtime, pg_cron, Vault). The `dev` branch deploys to production at the v3 domain until cutover.

## 1. Supabase

1. Create a project and apply every file in `supabase/migrations/` in order (Supabase MCP `apply_migration`, the SQL editor, or `supabase db push`).
2. **Auth → URL configuration:** Site URL = the app URL. Redirect URLs: `https://<app>/**`, `http://localhost:3000/**`, and your Vercel preview pattern.
3. **Reminder tick:** the migration creates a `pg_cron` job and a Vault secret `cron_secret` (generated in the database, never copied by hand). Point the job at the app once it's deployed:
   ```sql
   select vault.create_secret('https://<app>/api/cron/tick', 'tick_url');
   ```
   Check it with `select * from cron.job_run_details order by start_time desc limit 5;` and `select * from net._http_response order by created desc limit 5;`.

## 2. Environment variables

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + local | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel + local | Public by design (RLS protects data) |
| `SUPABASE_SECRET_KEY` | Vercel + local | **Secret.** Server only |
| `OWNER_EMAIL` | Vercel + local | Only this email can sign in |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Vercel + local | Calendar. See below |
| `GOOGLE_TOKEN_KEY` | Vercel + local | **Secret.** `openssl rand -base64 32`. Changing it disconnects Google accounts |
| `KIWI_WEBHOOK_URL`, `KIWI_WEBHOOK_TOKEN` | Vercel | **Secret.** From the Grok Bot "Reminder relay" routine |

Locally, `./scripts/pull-env.sh <project-ref> <owner-email>` writes the Supabase ones into `.env.local`. On Vercel: `vercel env add <NAME> production` (paste the value when prompted), then redeploy.

## 3. Google Calendar

1. Google Cloud console → create a project → enable **Google Calendar API**.
2. **OAuth consent screen:** External, add your account as a test user (or publish). Scopes: `openid`, `email`, `.../auth/calendar`.
3. **Credentials → OAuth client ID → Web application.** Authorized redirect URIs:
   - `https://<app>/api/google/callback`
   - `http://localhost:3000/api/google/callback`
4. Put the client id and secret in the env vars above, redeploy, then **Settings → Connect Google Calendar** in the app. Connect as many accounts as you like and pick which calendars show.

## 4. Grok Bot

Follow [`GROKBOT-SETUP.md`](GROKBOT-SETUP.md): mint an MCP token in Settings, add the MCP server in Grok Bot, set up Kiwi and the Reminder relay routine.

## 5. Verify

```bash
pnpm test                                   # unit tests; integration tests run too when .env.local has the secret key
HPM_TOKEN=hpm_... node scripts/smoke-mcp.mjs https://<app>   # end-to-end MCP check as a bot
```

## 6. Quick capture from your phone

Any token from **Settings → MCP tokens** also works for the capture endpoint. In the iOS Shortcuts app: *Ask for Input* → *Get Contents of URL* with:

- URL: `https://<app>/api/capture`, method `POST`
- Header: `Authorization: Bearer hpm_...`
- Request body: JSON, `content` = the input (optionally `source` = `"shortcut"`)

Add it to the Action Button or Back Tap, and captures land on the dashboard instantly (and in Kiwi's overview).
