# Hyperpolymath

**A one-screen life dashboard that your AI assistants run for you.**

Tasks, reminders, habits, quick captures, projects and your calendar live in one small, fast app. Your assistants (Claude, ChatGPT, Grok Bot, or anything that speaks [MCP](https://modelcontextprotocol.io)) read and write it through a built-in MCP server, and every change they make is logged with a one-tap revert.

[![CI](https://github.com/filippo-fonseca/hyperpolymath-v3/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/filippo-fonseca/hyperpolymath-v3/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## What it does

- **Today at a glance.** A widget grid with your tasks, agenda, habit rings, captures and team activity. Tap any widget to open its full view.
- **Assistants do the busywork.** "Remind me to call the dentist every day at 10 until I do it" becomes a task plus a reminder. Reply "done" to the nudge and it's checked off.
- **Nothing is a black box.** Every write, yours or a bot's, lands in an activity log with before and after snapshots and a Revert button.
- **Custom widgets without custom code.** A bot can publish a Slack roundup, a grocery list or a stat with a sparkline to the dashboard. Widgets are typed data, never bot-supplied HTML.
- **Live.** The dashboard updates within a second of a bot's change (Supabase Realtime).
- **Capture from anywhere.** An iOS Shortcut, Raycast or `curl` can drop a thought into your inbox.

## How it fits together

```
  Claude / ChatGPT / Grok Bot / ...  --MCP (bearer token)-->  /api/mcp
                                                                  |
  You, in the browser  --Server Actions-->  src/server/*  <-------+
                                                |
                                       Supabase (Postgres + RLS, Realtime)
```

One service layer, two front doors: the UI and the MCP server call the same functions, so they can't drift. More in [`docs/PLAN.md`](docs/PLAN.md).

## Quick start

You need Node 22+, pnpm, and a free [Supabase](https://supabase.com) project.

```bash
git clone https://github.com/filippo-fonseca/hyperpolymath-v3.git
cd hyperpolymath-v3
pnpm install
cp .env.example .env.local   # fill in your Supabase URL and keys
pnpm dev                     # http://localhost:3000
```

Apply the SQL in `supabase/migrations/` to your project first (in order). The full walkthrough, including Vercel, Google Calendar and the reminder tick, is in [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Connect an assistant

1. In the app, open **Settings, MCP tokens** and create a token. Copy the `hpm_...` value (it's shown once).
2. Point your assistant at `https://<your-app>/api/mcp` with the header `Authorization: Bearer hpm_...`.

Any client that supports remote MCP servers with custom headers works. For example, Claude Code:

```bash
claude mcp add --transport http hyperpolymath https://<your-app>/api/mcp \
  --header "Authorization: Bearer hpm_..."
```

Then ask it to call `get_overview`. Step-by-step setup with a coordinator bot and the reminder relay: [`docs/GROKBOT-SETUP.md`](docs/GROKBOT-SETUP.md). Day-to-day use: [`docs/WORKING-WITH-KIWI.md`](docs/WORKING-WITH-KIWI.md). Sign-in-with-OAuth for Claude and ChatGPT connectors is next on the [roadmap](docs/PLAN.md#v31-roadmap).

## Accounts and privacy

Anyone can create an account with an email and a password. Each account is private: every row carries the `user_id` it belongs to, Postgres row-level security lets a browser read only its own rows, and all writes go through the server, scoped to the signed-in account. MCP tokens are hashed at rest and only reach the account that made them. Reminders go to your own relay webhook, set in **Settings, Reminders**.

See [`SECURITY.md`](SECURITY.md) for the full model and how to report a vulnerability.

Letting any assistant (Claude, Grok Bot, ChatGPT, scripts) send you suggested tasks and captures to review: [`docs/AGENT-SUGGESTIONS.md`](docs/AGENT-SUGGESTIONS.md).

## Develop

```bash
pnpm dev          # local server
pnpm typecheck    # tsc
pnpm lint         # eslint
pnpm test         # vitest (integration tests run when .env.local has SUPABASE_SECRET_KEY)
pnpm build        # production build
```

On macOS with the Supabase CLI logged in, `./scripts/pull-env.sh <project-ref> <your-email>` writes `.env.local` for you. Contributions are welcome: start with [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Filippo Fonseca
