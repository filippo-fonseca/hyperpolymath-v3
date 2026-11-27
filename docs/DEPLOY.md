# Deploying Hyperpolymath v3

Stack: Next.js on Vercel, Supabase (Postgres, Auth, Realtime, pg_cron, Vault). The `dev` branch deploys to production at the v3 domain until cutover.

## 1. Supabase

1. Create a project and apply every file in `supabase/migrations/` in order (Supabase MCP `apply_migration`, the SQL editor, or `supabase db push`).
2. **Auth → URL configuration:** Site URL = the app URL. Redirect URLs: `https://<app>/**`, `http://localhost:3000/**`, and your Vercel preview pattern.
3. **Auth → Sign in / Providers → Email:** enabled, with new sign-ups allowed. People sign in with an email and a password; set the minimum password length to 8. With **Confirm email** on, new accounts get a confirmation link first. Supabase's built-in mailer only sends a couple of emails an hour, so either add custom SMTP (Auth → SMTP, e.g. Resend) or turn confirmation off. Password reset emails need a working mailer too.
4. **Accounts:** anyone can sign up. Each account is a row in `auth.users`, mirrored into `public.profiles` by a trigger. Every table carries `user_id`; RLS lets a signed-in account read only its own rows, and all writes go through the server.
5. **Reminder tick:** the migration creates a `pg_cron` job and a Vault secret `cron_secret` (generated in the database, never copied by hand). Point the job at the app once it's deployed:
   ```sql
   select vault.create_secret('https://<app>/api/cron/tick', 'tick_url');
   ```
   Check it with `select * from cron.job_run_details order by start_time desc limit 5;` and `select * from net._http_response order by created desc limit 5;`.

## 2. Environment variables

Every variable is listed with comments in [`.env.example`](../.env.example). Copy it to `.env.local` for local work.

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + local | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel + local | Public by design (RLS protects data) |
| `SUPABASE_SECRET_KEY` | Vercel + local | **Secret.** Server only |
| `OWNER_EMAIL` | Vercel + local | Optional. The one account allowed to use the `KIWI_WEBHOOK_*` relay below |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Vercel + local | Calendar. See below |
| `GOOGLE_TOKEN_KEY` | Vercel + local | **Secret.** `openssl rand -base64 32`. Encrypts Google tokens and reminder relay keys; changing it disconnects both |
| `KIWI_WEBHOOK_URL`, `KIWI_WEBHOOK_TOKEN` | Vercel | **Secret.** Optional fallback relay for `OWNER_EMAIL` only. Everyone else (and you, if you like) sets their own relay in **Settings → Reminders** |

Locally on macOS, `./scripts/pull-env.sh <project-ref> <owner-email>` writes the Supabase ones into `.env.local` (it reads the Supabase CLI login from the keychain). Elsewhere, copy them from **Project settings, API keys**. On Vercel: `vercel env add <NAME> production` (paste the value when prompted), then redeploy.

## 3. Google Calendar

1. Google Cloud console → create a project → enable **Google Calendar API**.
2. **OAuth consent screen:** External, add your account as a test user (or publish). Scopes: `openid`, `email`, `.../auth/calendar`.
3. **Credentials → OAuth client ID → Web application.** Authorized redirect URIs:
   - `https://<app>/api/google/callback`
   - `http://localhost:3000/api/google/callback`
4. Put the client id and secret in the env vars above, redeploy, then **Settings → Connect Google Calendar** in the app. Connect as many accounts as you like and pick which calendars show.

## 4. Connect an assistant

Claude, ChatGPT and Grok Bot sign in with Hyperpolymath over OAuth 2.1; there's nothing extra to configure (no new env vars). The OAuth tables come from `20261127020000_oauth.sql`, so make sure every migration is applied. Then follow [`connect/README.md`](connect/README.md) for your assistant. Grok Bot users also set up Kiwi and the Reminder relay with [`GROKBOT-SETUP.md`](GROKBOT-SETUP.md).

The issuer and every OAuth URL come from the host the request arrived on, so use one canonical domain for the MCP URL you give assistants. Tokens are bound to that host's `/api/mcp`, so a token issued on a preview deployment won't work on production.

## 5. Verify

CI (`.github/workflows/ci.yml`) runs the same gates on every push and pull request. Before your first deploy, also check:

```bash
pnpm test                                   # unit tests; integration tests run too when .env.local has the secret key
HPM_TOKEN=hpm_... node scripts/smoke-mcp.mjs https://<app>   # end-to-end MCP check as a bot
curl -s https://<app>/.well-known/oauth-authorization-server   # OAuth discovery answers
curl -sI https://<app> | grep -i content-security-policy     # security headers are on
```

`/api/mcp` allows 240 requests a minute per account and `/api/capture` 30; both answer `429` with `Retry-After` past that. The limits live in `src/server/rate-limit.ts` and need the `rate_limits` migration (without it the limits are skipped rather than blocking anyone).

## 6. Quick capture from your phone

Any personal token from **Settings → Connections** also works for the capture endpoint. In the iOS Shortcuts app: *Ask for Input* → *Get Contents of URL* with:

- URL: `https://<app>/api/capture`, method `POST`
- Header: `Authorization: Bearer hpm_...`
- Request body: JSON, `content` = the input (optionally `source` = `"shortcut"`)

Add it to the Action Button or Back Tap, and captures land on the dashboard instantly (and in Kiwi's overview).

## 7. iPhone, widgets and Mac menu bar (optional)

Apply the migrations first (`supabase db push`), since device keys need the `scope` column on `mcp_tokens`. Then build the apps from [`apple/`](../apple/README.md) and pair each device from **Settings → Phone and Mac**. The apps call `/api/v1` on this deployment ([`APP-API.md`](APP-API.md)); no extra env vars are needed.
