# Hyperpolymath v3: Plan

_Drafted 2026-10-10. Status: decisions locked 2026-10-11 (see Decisions)._

## The idea in one paragraph

Hyperpolymath v3 is a small, fast, one-screen dashboard plus a database, and Grok Bot is the way you actually operate it. A main bot, **Kiwi**, talks to the app through a Hyperpolymath MCP server: it reads live state, creates and completes tasks, logs habits, files captures, manages reminders, and publishes custom widgets. Other bots (a Slack roundup bot, a school bot, ...) can do the same. The app shows everything at a glance, lets you do anything by hand, and keeps a full, revertible log of what every bot did. There is no in-app AI agent.

## What we learned

### Grok Bot (xAI brand, run by Cursor/Anysphere; beta since 2026-08-11)
- Each Bot is a named agent with its own memory, and all Bots share one persistent cloud computer (browser, terminal, files). They can log into websites, which is why routines can reach almost anything.
- **Custom remote MCP servers are supported.** You add one by asking in chat with an HTTPS URL plus optional headers (e.g. `Authorization: Bearer ...`). OAuth servers get a sign-in card. It has to be public HTTPS, so localhost won't work. MCP servers are account-wide, so every Bot sees the same server with the same credentials.
- **Routines** are cron-like (minimum 5 minutes apart, at most 50 per Bot). Triggers include schedules, Slack, email, GitHub, and **webhooks**: `POST https://api2.cursor.sh/automations/webhook/<routine-id>` with a `crsr_` bearer token. The JSON body becomes that run's input. There's no callback: results land in the Bot's chat, so anything the app needs back comes through our MCP.
- Bots can create other Bots via chat (there's no API for it), message each other asynchronously, and form group chats of up to 6.
- Built-in connectors include Gmail (one account at a time), Google Calendar, Drive, Slack and Notion, plus about 219 plugins.
- Proactive channels: push notifications (desktop and mobile), plus email from the Bot's `@mail.grokbot.com` address.
- Usage is a weekly grant, and hourly routines can burn it fast. **Every reminder delivered through a Bot costs usage.**
- Light-mode tokens, pulled from the installed app (undocumented): background `#fcfcfc`, subtle `#f7f7f7`, text `#141414`, a gray ramp from `#fafafa` to `#262626`, agent bubble `#eeeeee`, user bubble `#070707`, accent `#1084fe`. The font is X's proprietary "XVF", so we'll use Inter or the system stack instead. The look is an iMessage-like layout with soft layered shadows and shape avatars (blob, squircle, hex) that have eyes.
- An existing email and calendar bot ("Dispatch") already runs nag-until-done reminders in chat, which is the pattern v3 formalizes.

### hyperpolymath-v2 (for ideas only; v3 starts from a fresh DB)
- **Why it got heavy:** about 196k lines of TypeScript, 38 pages, 75 API routes, about 60 tables, two drifting migration trees, a global layout that mounts a voice and agent stack on every page, and Haiku jobs on every write.
- **Ideas worth porting (rewritten small):**
  - the task recurrence rule (one live row per series that advances on completion)
  - the habits streak rules (scheduled days only, today never breaks a streak)
  - the 4-state habit ring
  - captures with `resurface_at`
  - the encrypted Google OAuth token handling
  - before-snapshot undo
- **Gaps v3 has to close:**
  - v2's MCP was **read-only and up to a day stale** (it served a nightly snapshot).
  - v2 had **no server-side reminders** (they only fired in an open tab or on the phone).
  - v2 had no durable undo history.

## Architecture

```
            Grok Bot cloud (Kiwi + sub-bots, routines, connectors)
                 |  MCP over HTTPS (bearer)          ^ webhook (reminder relay)
                 v                                   |
  +--------------------------- Vercel (Next.js) ------------------------------+
  |  /api/mcp   MCP server: tools -> service layer -> DB (+ action log)       |
  |  /          Dashboard: widget grid, pages, expand-to-full views           |
  |  /api/cron  reminder tick: due reminders -> webhook to Kiwi               |
  |  /api/google OAuth + Calendar proxy                                       |
  +---------------------------------------------------------------------------+
                 |                                    ^
                 v                                    | Realtime (row changes)
         Supabase (new project): Postgres, Auth (Google), Realtime
```

### Principles
1. **The DB is the single source of truth.** Kiwi never trusts its own memory for state and reads through MCP every time. The app subscribes to Realtime, so when Kiwi marks laundry done, your screen updates within a second. When you tick it in the app, Kiwi sees it on its next call.
2. **One service layer, two front doors.** The UI's server actions and the MCP tools call the same functions, so behavior can't drift.
3. **Everything is logged and revertible.** Every write (bot or you) produces an `actions` row with the actor, tool, entity, and before/after snapshots. Deletes are soft. Revert applies the before snapshot, and warns if the row has changed since.
4. **Bots own routines; the app owns data and display.** Routines live in Grok Bot. A widget is opt-in: a bot publishes to it only when you've asked for that. Most routines will never have one.
5. **Stay small.** Target: under 15 routes, under 15 tables, one migration tree (Drizzle), no background AI on writes.

### Stack
Next.js (App Router) + React 19 + TypeScript + Tailwind 4 on Vercel. Supabase (new project) for Postgres, Google Auth and Realtime. Drizzle for schema and migrations. `@modelcontextprotocol/sdk` for Streamable HTTP MCP. `motion` for the expand transitions, `dnd-kit` for rearranging. It's a PWA so it installs on the phone's home screen.

### Data model (first cut)
| Table | Purpose |
|---|---|
| `tasks` | title, notes, status (todo / doing / done), priority, due_at, recurrence jsonb, list/project, position, completed_at, deleted_at |
| `reminders` | task_id (nullable for free-standing), schedule jsonb (see below), until (`done` / date / count), channel, next_fire_at, last_fired_at, active |
| `habits`, `habit_logs` | days_of_week, icon, order; log per day with a 0 to 3 progress state |
| `captures` | content, urls, source (app / bot name / email), resurface_at, converted_task_id, archived_at |
| `widgets` | kind (digest / list / stat / timeline / markdown / table), title, owner_bot_id, payload jsonb, page, position, size (S/M/L), stale_after |
| `widget_snapshots` | payload history per publish, so you can scroll back through past roundups |
| `bots` | name, role, parent_bot_id (Kiwi as root), description, avatar shape/color, grokbot_id, last_seen_at |
| `actions` | actor (bot id or `you`), tool, entity_type, entity_id, before, after, summary, created_at, reverted_at, reverted_by |
| `google_accounts` | encrypted refresh tokens, selected calendar ids |

**The reminder schedule** is structured and easy for a model to emit, e.g. `{ "type": "every", "interval": "3h", "window": ["09:00","22:00"] }` or `{ "type": "daily", "at": ["10:00"] }`, plus an `until`. Kiwi turns your plain English ("press me every day at 10am until I say it's done") into that shape. In the app, a small picker covers the common cases, and a one-line text box hands anything harder to a single cheap model call.

### MCP tool surface (v1)
Every write tool takes a required `bot` argument (which bot is acting). The MCP server is account-wide in Grok Bot, so this is how actions get attributed; unknown names get auto-registered as teammates.

- **Context:** `get_overview` returns, in one call: today's tasks and overdue items, the next events, today's habits, unread captures, active reminders, and widget freshness. This is how Kiwi grounds every conversation.
- **Tasks:** `list_tasks`, `create_task`, `update_task`, `complete_task`, `delete_task`
- **Reminders:** `set_reminder`, `list_reminders`, `snooze_reminder`, `cancel_reminder`
- **Habits:** `list_habits`, `log_habit`, `create_habit`, `update_habit`
- **Captures:** `create_capture`, `list_captures`, `convert_capture_to_task`, `archive_capture`
- **Calendar:** `list_events`, `create_event`, `update_event`, `delete_event` (these proxy Google so calendar writes are logged and revertible too)
- **Widgets:** `list_widgets`, `create_widget`, `publish_widget`, `remove_widget`
- **Teammates and audit:** `register_bot`, `list_bots`, `list_actions`, `revert_action`

### Reminders: how a nudge reaches you
1. A Vercel cron `/api/cron/tick` runs every 5 minutes. It selects reminders with `next_fire_at <= now`, skips any whose task is done, and advances `next_fire_at`.
2. All the reminders due in that tick are **batched into one webhook call** to a single Kiwi routine ("Reminder relay"), so 5 reminders cost one Bot run, not five. Kiwi messages you in Grok Bot (push to your phone), and you reply "done" there, which calls `complete_task`.
3. No app push (Kiwi only, by decision). If the webhook call fails, the reminder stays due, retries next tick, and shows a warning on the Kiwi widget.
4. Marking the task done anywhere stops the reminder, because the tick checks the DB, not Kiwi's memory.

### The dashboard
- **One screen, home-screen style.** It's a grid of widgets in S/M/L sizes on swipeable pages with dots. Long-press (or edit mode) lets you drag to rearrange and resize.
- **Fixed widgets:** Today (tasks), Calendar (agenda), Habits (rings), Quick Capture (input plus recent), Kiwi (status and latest actions).
- **Custom widgets:** bot-published. Each one renders from its `kind`, shows "updated 7h ago by Slack Roundup", and greys out when it's past `stale_after`.
- **Tap to expand:** a widget opens with a shared-element animation into a full view.
  - Tasks get a Notion-style page with list, board, calendar and table views.
  - Calendar gets day and week views.
  - A custom widget shows its snapshot history.
- **Activity and teammates:** a sheet that shows the bot tree (Kiwi with its sub-bots), each bot's action timeline, and a Revert button on every action.
- **Visual language:** Grok Bot's light palette, generous whitespace, soft shadows, shape avatars for bots, and one accent blue. Nothing loads that isn't on screen.

## Build order (each phase ships something usable)

| Phase | Deliverable | Proves |
|---|---|---|
| **0. Scaffold** | New repo layout, new Supabase project, Vercel project, auth (only you), design tokens | Infra |
| **1. Core + MCP** | Schema, service layer, MCP server with token, action log and revert, `get_overview`, tasks/captures/habits tools | Kiwi can run your life over MCP end to end, before any UI polish. This is the riskiest piece, so it goes first. |
| **2. Dashboard shell** | Widget grid, pages, rearrange, expand; Today, Habits and Capture widgets; Realtime | The "it updates the moment Kiwi acts" feeling |
| **3. Reminders** | Schedule model, cron tick, webhook relay to Kiwi, "until done" | Proactive nudges |
| **4. Calendar** | Google OAuth (multiple calendars), agenda widget, calendar MCP tools, tasks with times on the calendar | Calendar sync both ways |
| **5. Custom widgets + Activity** | Widget kinds, publish flow, snapshots, teammates tree, revert UI | The ecosystem |
| **6. Full task views** | List / board / calendar / table, filters, recurrence | The "real app" depth |
| **7. First custom widgets** | Email digest (Kiwi/Dispatch) and Slack roundup, set up via chat | The dynamic loop works |

Grok Bot setup (done by you in chat, scripted in `docs/GROKBOT-SETUP.md` during phase 1):
1. Add the Hyperpolymath MCP with its URL and bearer header.
2. Give Kiwi its description (the standing prompt): source-of-truth rules, use `get_overview` first, always pass `bot`, ask before destructive actions.
3. Create the "Reminder relay" webhook routine.
4. Add a line to each sub-bot's description saying how it publishes to its widget.

## Risks and mitigations
- **No official Grok Bot API for bots or routines.** The app can't list your Grok Bot roster itself, so bots register themselves through MCP. We'll avoid the undocumented gateway on port 1340.
- **Usage burn.** Batched reminder webhooks (one run per tick, not per reminder) and `get_overview` (one call instead of five) keep Bot runs and tool calls down.
- **Bots bypassing the log.** A bot that uses Grok Bot's native Google Calendar connector writes straight to Google, and we can't see or revert that. Kiwi's prompt will prefer our calendar tools, and the calendar view still shows those events because it reads Google live.
- **Bad bot writes.** Soft deletes, before/after snapshots, one-tap revert, and a `bot` attribution on every row.
- **Token leakage.** The MCP token is hashed at rest and stored in Grok Bot's secure credential field. It can be rotated from settings.

## Decisions (2026-10-11)
1. **Kiwi = Dispatch, promoted.** Dispatch keeps its email and calendar context and becomes the coordinator (renamed to Kiwi in Grok Bot). Its description gets the Hyperpolymath rules added, not replaced.
2. **Reminders go through Kiwi only.** The app does no web push. The cron tick batches due reminders into one webhook run per tick, and you reply "done" to Kiwi. A failed webhook is retried on the next tick and flagged on the dashboard.
3. **Email is a bot-published digest widget.** There's no Gmail integration in the app.
5. **This repo is public.** No secrets, personal data, seed data from real accounts, or bot transcripts get committed. Config comes from env vars, and `.env*` is gitignored from the first commit.
4. **Hosting: `v3.hyperpolymath.com`** until cutover, with v2 left untouched until then.
