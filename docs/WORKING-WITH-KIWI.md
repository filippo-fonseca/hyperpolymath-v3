# Working with Kiwi

How to run your life through Grok Bot with Hyperpolymath as the source of truth. (Setup lives in [`GROKBOT-SETUP.md`](GROKBOT-SETUP.md).)

## The mental model

| Piece | Lives in | What it is |
|---|---|---|
| **Tasks, reminders, habits, captures, calendar** | Hyperpolymath | The data. One database, shown on the dashboard, edited by you or any bot. |
| **Life areas and projects** | Hyperpolymath | How the data is organised, like v2: areas (School, Health, Work...) hold projects (and classes); tasks and captures belong to a project, habits to an area. |
| **Kiwi** | Grok Bot | Your coordinator. Talks to you, reads and writes Hyperpolymath, creates and manages other bots. |
| **Sub-bots** (Slack Roundup, School, Social, ...) | Grok Bot | Specialists Kiwi creates. They use the same Hyperpolymath tools and report under Kiwi. |
| **Routines** | Run in Grok Bot, registered in Hyperpolymath | Scheduled *work* a bot does: scan Slack nightly, check Canvas, write a digest, log into a site. Every routine is listed on the Teammates page with an on/off switch. |
| **Widgets** | Hyperpolymath | Optional display surfaces. A routine publishes to one only if you asked for it on the dashboard. |
| **Activity log** | Hyperpolymath | Every change any bot makes, with a Revert button. |

## The one rule: reminders vs routines

> **"Remind me" goes to Hyperpolymath. "Go do something" goes to a Grok Bot routine.**

- **Reminders** ("remind me every day at 10am until it's done", "nudge me every 3 hours between 9 and 10pm", "ping me Friday at 3") are stored in Hyperpolymath with `set_reminder`. Every 5 minutes the app checks what's due and sends **one** batched message to Kiwi through the *Reminder relay* routine, and Kiwi messages you. Reply "done" and Kiwi completes the task, which stops every until-done reminder for it. You can also see, edit and cancel reminders on the task in the app.
- **Routines** are for jobs: "every night at 10pm check my Slack workspaces for missed messages", "every Sunday at 9 ask me for my timesheet hours and enter them". They run in Grok Bot because they need a bot to *do* something (browse, read mail, log in). They can still read and write Hyperpolymath, for example adding tasks they find or publishing a widget.

Why: reminders in the app are visible, editable and revertible, survive bot memory loss, and stop automatically when a task is done. A Grok Bot routine that only exists to remind you is invisible to the dashboard and keeps nagging after you've finished the thing.

The only reminder-shaped routine in Grok Bot is **Reminder relay** (the webhook one). Kiwi should not create others.

## Routines are visible and switchable in the app

Grok Bot has no API for listing routines, so bots register them with Hyperpolymath themselves (`register_routine`: name, schedule in words, what it does, which widget it feeds). Every run starts with `start_routine_run` and ends with `finish_routine_run`, so the Teammates page shows each bot, its routines, when they last ran and how it went.

The switch next to a routine in the app really pauses it: at the start of each run the bot checks in, sees it's off, and stops without doing the work. Flip it back on and the next run goes ahead. Deleting a routine for good still happens in Grok Bot (ask Kiwi), and Kiwi mirrors it with `remove_routine`.

## How you talk to it

Just talk normally to Kiwi. Some patterns:

| You say | What happens |
|---|---|
| "Finished laundry" | Kiwi finds the task and completes it; it disappears from Today and its reminders stop. |
| "Add heavy fluids revision, due today, high priority" | A task. |
| "Fill out my timesheet every Sunday at 1pm" | A recurring task (weekly, Sunday 13:00). Completing it rolls it to next Sunday. |
| "Press me every day at 10am until the resume is done" | A task plus a daily 10:00 reminder, until done. |
| "Remind me Oct 21 to 26 at 10:30 to work on the cardio tool" | A task plus a daily 10:30 reminder, until Oct 26. |
| "Idea: heart tissue video hook" | A capture (quick thought), not a task. |
| "Start a project 'Rover outreach' under Rover, due end of Nov" | A project in that area with an end date. Tasks you mention for it get filed there. |
| "Machine Elements is done for the semester" | The project's status becomes done; it moves to the quiet section. |
| "What's my day look like?" | Kiwi calls `get_overview`: calendar, due tasks, habits, reminders. |
| "Move my 3pm to 4" / "Add dentist Tue 2pm" | Calendar changes through Hyperpolymath, so they're logged and revertible. |
| "Did my reading today" | Logs the habit. |
| "I'm in Rome until Sunday" | `set_timezone` so "today" and reminder times follow you. |
| "Make a bot that checks Slack nightly and put it on the dashboard" | Kiwi creates the bot and routine, the bot creates a digest widget and publishes each night. |
| "Undo that" | Kiwi reverts its last action (or use Revert in the app). |

You can always do the same things by hand in the app. Kiwi always reads fresh state, so it sees your changes on its next message.

## Moving everything over (first run)

Once the MCP is connected and the Reminder relay is set up, send Kiwi something like:

> Let's move everything into Hyperpolymath. (1) Set up my life areas and current projects (including classes) in Hyperpolymath, then go through what you and the other bots are tracking for me and backlog every pending to-do as a task with the right due date, time, priority and project. (2) For every reminder you or the other bots set up as a Grok Bot routine, recreate it with set_reminder (attached to its task where there is one, keeping the same schedule and end condition), then list those routines and ask me before deleting them. (3) Leave routines that do actual work running, but call update_bot for every bot so they all show up in Hyperpolymath under you with a role, register every remaining routine with register_routine (and tell each bot to call start_routine_run / finish_routine_run in its routines from now on), and tell me which routines could be widgets. (4) Tell me anything the system wouldn't let you do.

Kiwi will ask before deleting anything. Check the Activity view afterwards; anything wrong is one Revert away.

## Widgets from routines

Ask for it explicitly: *"...and show it on Hyperpolymath."* The bot creates one widget (a digest, list, stat, timeline, table or markdown) and republishes it at the end of every run. Old versions are kept, so expanding the widget shows past runs. If a run is missed the widget greys out after its staleness window.

## Limits worth knowing

- **Reminder delivery needs the relay.** Until `KIWI_WEBHOOK_URL` and `KIWI_WEBHOOK_TOKEN` are set, reminders are saved and shown in the app but not delivered. They retry every 5 minutes and fire once the relay works.
- **Each relay run uses Grok Bot usage.** Reminders due at the same time are batched into one run, so prefer "10am daily" over "every 15 minutes".
- **Attribution is honour-system.** Bots say who they are; the log is for your review and undo, not security.
- **Google Calendar writes from Grok Bot's own calendar connector bypass the log.** Kiwi is told to use Hyperpolymath's calendar tools instead.
- **Bots can't see the app's screen.** They read data through tools. If a bot says it can't do something, it's usually a missing tool: ask Claude to add it.
