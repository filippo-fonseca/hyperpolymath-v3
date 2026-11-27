# Agent suggestions: let every assistant feed your inbox

Your assistants see a lot that you never write down: a deadline buried in an email, a follow-up from a meeting, a good idea halfway through a chat. Suggestions let any connected agent (Claude, Grok Bot, ChatGPT, a script) send those to Hyperpolymath on its own, without cluttering your real lists.

Think of it as a tray on your desk. Agents drop things in. Nothing becomes a task or capture until you say yes.

```
agent notices something  ──►  suggest  ──►  Suggested tray  ──►  Accept  ──►  task / capture (credited to the agent)
                                                         └──►  Dismiss ──►  not suggested again for 30 days
```

Things you ask for directly ("add a task to call the bank") still go straight in with `create_task` / `create_capture`. Suggestions are only for what an agent picks up on its own.

## What you see

- **Capture widget:** a "3 suggested by Kiwi" strip whenever something is waiting.
- **Capture view (tap the widget):** the Suggested tray, soonest-due first. Each card shows who suggested it, why ("Gmail: unanswered for 3 days"), and any due date, priority or project. **Add task / Capture it** accepts it, **Edit** lets you fix the text or date first, **×** dismisses it. **Accept all** and **Dismiss all** clear the tray in one go.
- **Activity:** every suggestion, accept and dismiss is logged. Reverting an accept removes the task or capture it made and puts the suggestion back in the tray.

## Guardrails (enforced by the server, not the prompt)

| Rule | Why |
| --- | --- |
| Duplicates of a waiting suggestion are skipped | Agents can re-scan the same inbox every hour without piling up copies |
| Suggestions that match an open task or live capture are skipped | No "add X" when X is already on your list |
| Dismissed suggestions aren't offered again for 30 days | Saying no once is enough |
| 25 suggestions per agent per day, 100 waiting at most | A runaway agent can't bury you |
| Up to 10 items per call | A routine reports everything it found in one call, which keeps token use low |

Matching ignores case, punctuation, accents and prefixes like "TODO:", so "Email Prof. Lee!" and "email prof lee" count as the same thing.

## Turn it on in your assistant

The `suggest` tool and a one-line rule ship with the MCP server, so most MCP clients start using it without any setup. A short standing instruction makes it reliable, especially for clients that ignore server instructions. Paste the block below wherever your assistant keeps standing instructions.

```
Hyperpolymath is where my tasks and ideas live. When you notice something I'd likely want as a task or a quick capture (a deadline or request in an email or message, a follow-up from a meeting, an idea worth keeping) and I didn't ask you to save it, send it to Hyperpolymath with the suggest tool instead of just mentioning it. Give each one a short reason that says where you saw it. Batch everything from one task or routine run into one suggest call. Only suggest what I'd plausibly act on. If I ask you to add something, create it directly instead.
```

Where it goes:

- **Claude (claude.ai, desktop, mobile):** add Hyperpolymath as a connector (Settings, Connectors, Add custom connector, URL `https://<your-app>/api/mcp`). Paste the block into a Project's instructions, or into Settings, Profile, "What personal preferences should Claude consider". Claude Code: add it to your `CLAUDE.md`.
- **Grok Bot:** append the block to the coordinator's description (see [GROKBOT-SETUP.md](GROKBOT-SETUP.md)), and to any routine that scans email, Slack or calendars. Routines should still finish with `finish_routine_run`; a run whose only output is suggestions counts as quiet, so no message to you is needed.
- **ChatGPT:** add the MCP server as a connector where your plan supports it, then paste the block into the GPT's or Project's instructions. Without MCP, use the HTTP endpoint below as a GPT Action.
- **Anything else:** any MCP client works the same way. Scripts and automations can use HTTP.

Always pass your agent's own name as `bot` on MCP calls (or `source` over HTTP) so suggestions are credited and rate-limited per agent.

## The tools

| Tool | What it does |
| --- | --- |
| `suggest` | `items`: 1 to 10 of `{ kind: "task" \| "capture", content, reason?, project?, due_date?, due_time?, priority?, notes? }`. Returns one `outcome` per item: `pending`, `duplicate`, `exists` or `dismissed_before`. |
| `list_suggestions` | What's waiting (or recently accepted or dismissed). |
| `review_suggestion` | Accept or dismiss one, only when you say so in chat ("yes, add the second one"). Accepting can override the text, project, due date or priority. |

`get_overview` includes `suggestions_waiting_for_owner` (a count), so an agent knows the tray isn't empty without spending tokens on the list.

## HTTP, for agents without MCP

Use the same token you made for MCP (Settings, Grok Bot, or wherever your version of the app lists MCP tokens).

```bash
curl -X POST https://<your-app>/api/suggest \
  -H "Authorization: Bearer hpm_..." \
  -H "Content-Type: application/json" \
  -d '{"source": "chatgpt", "items": [{"kind": "task", "content": "Reply to Dr. Patel", "reason": "Gmail: she asked for your CV", "due_date": "2026-11-29"}]}'
```

A single item can be sent at the top level instead of inside `items`. The response is `{"results": [{"content", "outcome", "id"}]}`; going over a limit returns `429`.
