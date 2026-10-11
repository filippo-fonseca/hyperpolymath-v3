# Connecting Grok Bot to Hyperpolymath

Hyperpolymath is operated by Grok Bot teammates over MCP. One bot is the coordinator ("Kiwi"); it can create and manage sub-bots, and every bot reads and writes the same database through the same server. Setup takes about five minutes.

## 1. Mint a token

Open the dashboard, then **Settings → MCP tokens → Create token**. Name it "Grok Bot". Copy the `hpm_...` value; it is shown once. (Revoke and re-mint here any time.)

## 2. Add the MCP server in Grok Bot

In any bot's chat, send:

> Add a custom MCP server named "Hyperpolymath". URL: `https://<your-app>/api/mcp`. Header: `Authorization: Bearer <paste token>`. Store the token as a secret.

MCP servers apply to every bot on the account, so this is done once. Ask the bot to call `get_overview` to confirm it works.

## 3. Make your coordinator Kiwi

Pick (or create) the coordinator bot, rename it **Kiwi**, and append this to its description (the standing prompt). Keep whatever else it already knows.

```
You are Kiwi, coordinator of the Hyperpolymath teammates.
- Hyperpolymath (MCP) is the source of truth for my tasks, reminders, habits, quick captures and dashboard widgets. Call get_overview before answering anything about my day, and never answer from memory.
- Always pass bot: "Kiwi" on Hyperpolymath tools.
- When I say something is done, find it and complete_task. Quick thoughts go to create_capture.
- Reminders: turn my words into set_reminder schedules ("every day at 10am until I say done" = daily 10:00, until done).
- When you create a new bot for me, tell it to pass its own name as `bot`, and call update_bot with its role and parent "Kiwi".
- Only create or publish dashboard widgets when I ask for a routine to show up on Hyperpolymath.
- Ask before deleting. If you make a mistake, revert_action.
```

Then tell Kiwi: "Call update_bot for yourself with role 'Coordinator'." The first bot that ever connects is registered as coordinator automatically.

## 4. Reminder relay routine (how nudges reach you)

Hyperpolymath checks for due reminders every 5 minutes and sends **one** webhook per batch to Kiwi, so five due reminders cost one bot run.

1. Ask Kiwi: *"Create a routine called 'Reminder relay' with a webhook trigger. When it runs, the input is a JSON batch of due Hyperpolymath reminders; follow its `instructions` field and message me."*
2. Grok Bot gives you a webhook URL (`https://api2.cursor.sh/automations/webhook/<routine-id>`) and a bearer key (`crsr_...`).
3. Add both to the app's environment (never commit them):
   ```
   KIWI_WEBHOOK_URL=https://api2.cursor.sh/automations/webhook/<routine-id>
   KIWI_WEBHOOK_TOKEN=crsr_...
   ```
   On Vercel: Project → Settings → Environment Variables (Production), then redeploy.

Reply "done" to a nudge and Kiwi completes the task, which stops every until-done reminder for it.

## 5. Custom widgets from routines

Any routine can publish to the dashboard, but only when you ask. Example:

> Kiwi, create a bot "Slack Roundup" that checks my Slack workspaces every night at 10pm for messages I missed. Make it a widget on Hyperpolymath.

The bot calls `create_widget` once (kind `digest`, with a staleness window), then `publish_widget` at the end of every run. History is kept, and you can scroll back through past runs in the expanded widget. Routines without widgets just run in Grok Bot as usual.

Widget kinds: `digest` (sections of items), `list`, `stat` (value, delta, sparkline), `timeline`, `markdown`, `table`. The exact payload shapes are in the `create_widget` tool description.

## 6. Watching and undoing

Everything a bot changes lands in **Kiwi → Activity**: who did what, when, and a Revert button on each action. Bots can also undo their own mistakes with `revert_action`.

## Troubleshooting

- **401 from the MCP server:** the token was revoked or mistyped. Mint a new one.
- **No nudges arriving:** check that `KIWI_WEBHOOK_URL` and `KIWI_WEBHOOK_TOKEN` are set and the routine is enabled. Failed deliveries retry every tick and show on the Kiwi widget.
- **A bot shows up twice:** names are matched case-insensitively. Rename it in Grok Bot or tell it the exact name to pass as `bot`.
