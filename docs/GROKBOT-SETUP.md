# Connecting Grok Bot to Hyperpolymath

Hyperpolymath is operated by Grok Bot teammates over MCP. Once you're set up, read [`WORKING-WITH-KIWI.md`](WORKING-WITH-KIWI.md) for how to use it day to day.

One bot is the coordinator ("Kiwi"); it can create and manage sub-bots, and every bot reads and writes the same database through the same server. Setup takes about five minutes.

## 1. Mint a token

Open the dashboard, then **Settings → MCP tokens → Create token**. Name it "Grok Bot". Copy the `hpm_...` value; it is shown once. (Revoke and re-mint here any time.)

## 2. Add the MCP server in Grok Bot

In any bot's chat, send:

> Add a custom MCP server named "Hyperpolymath". URL: `https://<your-app>/api/mcp`. Header: `Authorization: Bearer <paste token>`. Store the token as a secret.

MCP servers apply to every bot on the account, so this is done once. Ask the bot to call `get_overview` to confirm it works.

## 3. Make your coordinator Kiwi

Pick (or create) the coordinator bot and rename it **Kiwi**. Then append the standing prompt to its description, keeping whatever else it already knows: from [`STANDING-PROMPT.md`](STANDING-PROMPT.md), paste block 1 (base, with `<NAME>` set to Kiwi), block 2 (the butler persona) and block 3 (scheduled routines). The server's own instructions cover the rest.

Then tell Kiwi: "Call update_bot for yourself with role 'Coordinator'." The first bot to call Hyperpolymath becomes the coordinator automatically (whatever its name), and every other bot is filed under it. To change it later, ask Kiwi to call `set_coordinator`. Retire a bot from the teammates view with `archive_bot` (its history stays).

## 4. Reminder relay routine (how nudges reach you)

Hyperpolymath checks for due reminders every 5 minutes and sends **one** webhook per batch to Kiwi, so five due reminders cost one bot run.

1. Ask Kiwi: *"Create a routine called 'Reminder relay' with a webhook trigger. When it runs, the input is a JSON batch of due Hyperpolymath reminders; follow its `instructions` field and message me."*
2. Grok Bot gives you a webhook URL (`https://api2.cursor.sh/automations/webhook/<routine-id>`) and a bearer key (`crsr_...`).
3. In the app, open **Settings → Reminders** and paste both under **Use my own webhook**. The key is stored encrypted and only ever used to send your own reminders. (Whoever runs the server can instead set `KIWI_WEBHOOK_URL` and `KIWI_WEBHOOK_TOKEN` in the environment; that relay only serves the `OWNER_EMAIL` account.)

Reply "done" to a nudge and Kiwi completes the task, which stops every until-done reminder for it.

The same call also carries any captures that just came back on their resurface schedule (`resurfaced_captures`), so Kiwi can mention them in a line each. Reply "seen" and Kiwi marks them seen, which clears them from the Resurfaced section on the dashboard. If no relay is set up, resurfaced captures still show on the dashboard.

## 5. Custom widgets from routines

Any routine can publish to the dashboard, but only when you ask. Example:

> Kiwi, create a bot "Slack Roundup" that checks my Slack workspaces every night at 10pm for messages I missed. Make it a widget on Hyperpolymath.

The bot calls `create_widget` once (kind `digest`, with a staleness window), then `publish_widget` at the end of every run. History is kept, and you can scroll back through past runs in the expanded widget. Routines without widgets just run in Grok Bot as usual.

Widget kinds: `digest` (sections of items), `list`, `stat` (value, delta, sparkline), `timeline`, `markdown`, `table`. The exact payload shapes are in the `create_widget` tool description. Items and timeline events take an `at` (an ISO date or date-time, like `2026-11-30T23:59-05:00`): the app shows it in your timezone ("Mon 11:59pm", "Tomorrow"), highlights what is coming up in the next day, and fades what has passed, so bots never format or convert times in the text themselves.

## 6. Watching and undoing

Everything a bot changes lands in **Kiwi → Activity**: who did what, when, and a Revert button on each action. Bots can also undo their own mistakes with `revert_action`.

## Troubleshooting

- **401 from the MCP server:** the token was revoked or mistyped. Mint a new one.
- **No nudges arriving:** check that `KIWI_WEBHOOK_URL` and `KIWI_WEBHOOK_TOKEN` are set and the routine is enabled. Failed deliveries retry every tick and show on the Kiwi widget.
- **A bot shows up twice:** names are matched case-insensitively. Rename it in Grok Bot or tell it the exact name to pass as `bot`.
