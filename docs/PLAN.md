# Hyperpolymath v3: Plan

_Drafted 2026-10-10, decisions locked 2026-10-11. Rewritten 2026-11-27 to match what shipped and to set the v3.1 roadmap._

## The idea in one paragraph

Hyperpolymath is a small, fast, one-screen life dashboard plus a database, and AI assistants are the way you actually operate it. Your main assistant (we call ours **Kiwi**) talks to the app through the Hyperpolymath MCP server: it reads live state, creates and completes tasks, logs habits, files captures, manages reminders, and publishes custom widgets. Other bots (a Slack roundup bot, a school bot, ...) can do the same. The app shows everything at a glance, lets you do anything by hand, and keeps a full, revertible log of what every bot did. There is no in-app AI agent: the intelligence lives in whichever assistant you connect.

v3 started on Grok Bot. v3.1 makes it **assistant-agnostic**: Claude, ChatGPT, Grok Bot or anything else that speaks MCP should connect with a short, clear setup.

## Architecture

```
     Your assistants (Claude, ChatGPT, Grok Bot, ...): bots, routines, connectors
                 |  MCP over HTTPS (bearer token)      ^ webhook (reminder relay)
                 v                                     |
  +--------------------------- Vercel (Next.js 16) -----------------------------+
  |  /api/mcp      MCP server: 53 tools -> service layer -> DB (+ action log)   |
  |  /api/capture  quick capture from Shortcuts, Raycast, curl                  |
  |  /api/cron     reminder tick: due reminders -> one webhook per account      |
  |  /api/google   Calendar OAuth (multiple accounts)                           |
  |  /             dashboard: widget grid, full-page views, settings            |
  +-----------------------------------------------------------------------------+
                 |                                     ^
                 v                                     | Realtime (row changes)
       Supabase: Postgres + RLS, Auth (email and password), Realtime,
                 Storage (avatars), pg_cron + pg_net, Vault
```

### Principles
1. **The DB is the single source of truth.** Assistants never trust their own memory for state; they read through MCP every time. The browser subscribes to Realtime, so when Kiwi marks laundry done, your screen updates within a second.
2. **One service layer, two front doors.** Server Actions and MCP tools are thin wrappers over `src/server/*`, so behavior can't drift.
3. **Everything is logged and revertible.** Every write (bot or you) produces an `actions` row with the actor, tool, entity, and before/after snapshots. Deletes are soft. Revert applies the before snapshot and warns if the row changed since.
4. **Bots own routines; the app owns data and display.** Routines run in the assistant's platform and register here so you can see and pause them. Custom widgets are typed data, never bot-supplied code or HTML.
5. **Stay small.** One migration tree, no UI kits, no background AI on writes. (The original targets were under 15 routes and 15 tables; we're at 12 routes and pages and 21 tables, which is fine as long as each earns its place.)

### Stack
Next.js 16 (App Router, Cache Components) + React 19 + TypeScript + Tailwind 4 on Vercel. Supabase for Postgres, Auth, Realtime, Storage, pg_cron and Vault. Plain SQL migrations in `supabase/migrations/` with generated types in `src/lib/database.types.ts`. `@modelcontextprotocol/sdk` (Streamable HTTP, stateless) for MCP, `zod` for validation, `motion` for transitions, `dnd-kit` for rearranging. It installs as a PWA.

### Data model
| Table | Purpose |
|---|---|
| `profiles` | one per account, mirrored from `auth.users` by a trigger; display name and avatar |
| `settings` | timezone, task view options and other per-account preferences |
| `tasks` | title, notes, status, priority P1 to P4, due date and time, recurrence, project, position, soft delete |
| `reminders` | optional task, structured schedule, `until` (done / date / count), next and last fire times, last error |
| `reminder_relays` | each account's own relay webhook URL and encrypted key |
| `habits`, `habit_logs` | scheduled days, icon, area; one log per day with a 0 to 3 progress state |
| `captures`, `capture_comments` | quick thoughts with links, source, a resurface schedule, seen state and reply threads |
| `areas`, `projects` | life areas (School, Health, ...) holding projects and classes |
| `widgets`, `widget_snapshots` | custom widgets (kind, typed payload, size, owner bot, staleness) and their publish history |
| `bots` | teammates: name, role, parent, avatar, coordinator flag, archive |
| `routines`, `routine_runs` | routines registered by bots, with an on/off switch and run history |
| `actions` | the audit log with before/after snapshots and revert state |
| `mcp_tokens` | hashed bearer tokens, per account, revocable |
| `google_accounts` | encrypted refresh tokens and selected calendars |
| `system_state` | tick heartbeat and other server bookkeeping |
| `rate_limits` | fixed-window counters for the token endpoints (unlogged) |

### MCP tools (53)
Every write tool takes a `bot` argument (who is acting); unknown names are registered as teammates under the coordinator.

- **Context:** `get_overview` (one call for today's tasks, habits, captures, reminders and widgets), `set_timezone`
- **Tasks:** `list_tasks`, `create_task`, `update_task`, `complete_task`, `reopen_task`, `delete_task`
- **Reminders:** `set_reminder`, `list_reminders`, `snooze_reminder`, `cancel_reminder`
- **Habits:** `list_habits`, `log_habit`, `create_habit`, `update_habit`
- **Captures:** `create_capture`, `list_captures`, `update_capture`, `mark_capture_seen`, `list_capture_comments`, `add_capture_comment`, `convert_capture_to_task`
- **Areas and projects:** `list_areas`, `create_area`, `update_area`, `get_project`, `create_project`, `update_project`, `delete_project`
- **Calendar:** `list_events`, `list_calendars`, `create_event`, `update_event`, `delete_event` (proxied through Google so writes are logged)
- **Widgets:** `list_widgets`, `create_widget`, `publish_widget`, `update_widget`, `remove_widget`
- **Teammates and routines:** `list_bots`, `update_bot`, `rename_bot`, `set_coordinator`, `archive_bot`, `list_routines`, `register_routine`, `update_routine`, `remove_routine`, `start_routine_run`, `finish_routine_run`
- **Audit:** `list_actions`, `revert_action`

### Reminders: how a nudge reaches you
1. Supabase `pg_cron` calls `/api/cron/tick` every 5 minutes, but only when something is actually due (plus once an hour for housekeeping). The secret lives in Vault; no person handles it.
2. The tick batches each account's due reminders and resurfaced captures into **one webhook call** to that account's relay, so five reminders cost one assistant run, not five.
3. The assistant messages you; you reply "done" and it calls `complete_task`, which stops every until-done reminder for that task.
4. A failed webhook leaves the reminder due, retries next tick, and shows on the dashboard. Accounts with no relay are skipped without churning.

### Security
Per-account RLS, a server-only write path scoped by `user_id`, hashed MCP tokens, AES-256-GCM for stored third-party secrets, rate limits on the token endpoints, a content security policy and HSTS, and CI with a dependency audit. Details and known limits: [`SECURITY.md`](../SECURITY.md).

## Status (2026-11-27)

| Area | State |
|---|---|
| Core + MCP | **Done.** Service layer, 53 tools, action log with revert, integration tests |
| Accounts | **Done.** Open sign-up with email and password, per-account RLS, profiles with photo |
| Dashboard | **Done, needs a design pass.** Widget grid with S/M/L/wide sizes, app bar, Cmd+K search, full-page views, Realtime |
| Tasks | **Done.** Todoist-style Today, Upcoming and All, quick-add parsing, view options, recurrence with catch-up |
| Reminders | **Done.** Gated pg_cron tick, per-account relays, batched webhooks, retries |
| Calendar | **Done.** Multiple Google accounts, agenda and week views, logged writes |
| Captures | **Done.** Feed with replies, resurface schedules, iOS Shortcut endpoint |
| Areas and projects | **Done.** List and tree views, MCP tools |
| Custom widgets + Teammates | **Done.** Typed payloads, snapshots, bot tree, routines with on/off, revert UI |
| Landing, terms, privacy | **Done.** |
| Release hygiene | **Done.** MIT license, `.env.example`, `SECURITY.md`, `CONTRIBUTING.md`, CI, rate limits, security headers |

## v3.1 roadmap

In order. Each step ships on its own.

1. **Assistant-agnostic MCP.** OAuth 2.1 on `/api/mcp` (so Claude and ChatGPT connectors can sign in without pasting a token), with bearer tokens kept for everything else. Move the Kiwi persona and Grok-specific routine rules out of the server instructions into per-assistant setup docs (Claude, ChatGPT, Grok Bot, generic MCP).
2. **Token efficiency.** Trim server instructions and tool descriptions, return compact JSON, and keep `get_overview` the one call an assistant needs to start.
3. **Dashboard design pass.** Even card heights, no empty gaps, readable tables, stale items quieter, stronger titles and contrast.
4. **Widgets v2 and Insights.** Chart widget kinds (line, bar, ring, heatmap) and an Insights view built on `actions`, `habit_logs` and `tasks`.
5. **Read API.** A small, token-scoped JSON API for native clients.
6. **Native apps.** iOS app with WidgetKit widgets, then a macOS menu bar app, both on the read API.

## Risks and mitigations
- **Usage burn on assistant platforms.** Batched reminder webhooks and a one-call `get_overview` keep runs and tool calls down; the tick only fires when something is due.
- **Bots bypassing the log.** A bot using its platform's own Google Calendar connector writes straight to Google, which we can't revert. Setup docs steer assistants to our calendar tools; the calendar view still shows those events because it reads Google live.
- **Bad bot writes.** Soft deletes, before/after snapshots, one-tap revert and a `bot` attribution on every row.
- **Token leakage.** Tokens are hashed at rest, shown once, revocable, and rate limited. OAuth (roadmap step 1) removes copy-paste for the clients that support it.
- **Attribution is self-declared.** Bots sharing one token can claim any name. The log is for your own review and undo, not a security boundary.

## Decisions
1. **Reminders go through your assistant.** The app does no web push. The tick sends one webhook per account per tick, and you reply "done" to the assistant.
2. **Email is a bot-published digest widget.** There's no Gmail integration in the app.
3. **Open sign-up, private accounts** (2026-10-19). Anyone can create an account; RLS and the server layer keep each one to its own rows.
4. **This repo is public and MIT licensed** (2026-11-27). No secrets, personal data, real-account seed data or bot transcripts get committed. Config comes from env vars, and `.env*` (except `.env.example`) is gitignored.
5. **Hosting:** the `dev` branch deploys to production at the v3 domain.
6. **Assistant-agnostic** (2026-11-27). Grok Bot stays supported, but no assistant is privileged in the server; personas and platform rules live in setup docs.

## Background: what we learned building v3

### hyperpolymath-v2 (ideas only; v3 started from a fresh DB)
v2 grew to about 196k lines, 38 pages, 75 API routes and about 60 tables, with two drifting migration trees and AI jobs on every write. Its MCP was read-only and up to a day stale, reminders only fired in an open tab, and there was no durable undo. v3 kept the good ideas, rewritten small: the one-live-row task recurrence, habit streak rules (scheduled days only, today never breaks a streak), the 4-state habit ring, resurfacing captures, encrypted Google tokens, and before-snapshot undo.

### Grok Bot (the first assistant we built for)
Custom remote MCP servers are added in chat with an HTTPS URL and headers, and apply to every bot on the account. Routines can be triggered by schedules, Slack, email, GitHub and webhooks (`POST https://api2.cursor.sh/automations/webhook/<routine-id>` with a `crsr_` bearer), which is what the reminder relay uses. There is no API for listing bots, so bots register themselves through MCP. Setup: [`GROKBOT-SETUP.md`](GROKBOT-SETUP.md).
