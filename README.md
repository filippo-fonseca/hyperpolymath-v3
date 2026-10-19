# Hyperpolymath v3

A small, fast, one-screen life dashboard whose primary interface is a team of Grok Bot agents talking to it over MCP.

See [`docs/PLAN.md`](docs/PLAN.md) for the architecture and build plan.

## Accounts

Anyone can create an account with an email and a password (8 characters or more). Forgot it? The sign-in page emails a reset link, and you can change it any time in Settings.

Each account is private. Every row in the database carries the `user_id` of the account it belongs to, and Postgres row-level security lets a signed-in account read only its own rows. The browser never writes: all changes go through the server, which scopes every query by the signed-in account. `public.profiles` lists every account (kept in sync with `auth.users` by a trigger).

Bots get in with MCP tokens you create in Settings, and each token only reaches the account that made it. Reminders go to your own Grok Bot through the relay webhook you set in **Settings → Reminders**, so they never land in someone else's bot.

Setting up your own deployment: [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Develop

```bash
pnpm install
./scripts/pull-env.sh   # writes .env.local from your Supabase project (needs the Supabase CLI, logged in)
pnpm dev
```
