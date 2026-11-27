# Security

Hyperpolymath holds personal data (tasks, habits, notes, calendar access), so security reports are welcome and taken seriously.

## Reporting a vulnerability

Please **don't open a public issue**. Report privately through GitHub instead:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Describe what you found, how to reproduce it, and what an attacker could do with it.

You'll get a reply within a few days. Once a fix ships, you're credited in the advisory unless you'd rather not be.

**In scope:** this repository's code (the Next.js app, the MCP server, the Supabase migrations) and its documented setup.
**Out of scope:** someone else's deployment, denial of service by sheer volume, and bugs in Supabase, Vercel, Google or bot platforms themselves (report those upstream).

## Supported versions

Only the latest commit on `dev` is supported. There are no backported fixes.

## How the app protects your data

| Layer | What it does |
|---|---|
| **Accounts** | Supabase Auth (email and password). Each account sees only its own data. |
| **Row-level security** | Every table carries `user_id`. RLS lets a signed-in browser read only its own rows, and the browser never writes. |
| **One server layer** | All writes go through `src/server/*`, which uses the secret key and scopes every query by `user_id`. Server Actions and the MCP server are thin wrappers over it. |
| **MCP tokens** | `hpm_` tokens carry 192 random bits. Only a SHA-256 hash is stored; the token is shown once. Each token reaches only the account that made it and can be revoked in Settings. |
| **Encrypted secrets** | Google refresh tokens and reminder relay keys are encrypted at rest with AES-256-GCM (`GOOGLE_TOKEN_KEY`). |
| **Cron** | The reminder tick authenticates with a secret generated inside Postgres (Vault) that no person ever handles. |
| **Rate limits** | `/api/mcp` allows 240 requests a minute per account and `/api/capture` 30. Repeated bad tokens from one address are refused for a few minutes. |
| **Headers** | A content security policy (no third-party scripts, no framing), HSTS, `nosniff`, a strict referrer policy and a Permissions-Policy that turns off device APIs. |
| **Audit log** | Every write, by you or a bot, is logged with before and after snapshots and can be reverted. |
| **Dependencies** | CI runs `pnpm audit --prod` on every push and pull request. |

## Known limits

- **Bot attribution is self-declared.** Bots that share one MCP token pass their own name as `bot`. The activity log is for your own review and undo, not a security boundary. Give each platform its own token so you can revoke one without the others.
- **The MCP token is a bearer credential.** Anyone holding it can act as you through MCP. Store it in your bot platform's secret field, never in a prompt or a chat message.
- **The per-address guard is best effort.** It lives in each server instance's memory and trusts `X-Forwarded-For`, which Vercel sets. If you self-host behind another proxy, make sure it overwrites that header.

## Running your own deployment

- Keep `SUPABASE_SECRET_KEY` and `GOOGLE_TOKEN_KEY` out of the browser, the repo and your logs. `.env*` is gitignored; start from `.env.example`.
- Apply every migration in `supabase/migrations/`, including the RLS policies.
- Rotate MCP tokens you no longer use in **Settings, MCP tokens**.
