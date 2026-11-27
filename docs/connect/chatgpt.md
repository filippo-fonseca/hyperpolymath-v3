# Connect ChatGPT

ChatGPT connects to custom MCP servers from the web app and signs in with Hyperpolymath, so there is no token to copy. Menu names and plan availability have been changing; the steps below match ChatGPT as of November 2026.

## Steps

1. In ChatGPT on the web, open **Settings → Apps** (sometimes **Apps & Connectors**) **→ Advanced settings** and turn on **Developer mode**. Accept the warning.
2. Click **Create app** (or **Create**).
3. Name it `Hyperpolymath`, paste your server URL `https://<your-app>/api/mcp`, and set **Authentication** to **OAuth**.
4. Tick **I understand and want to continue**, then **Create**.
5. Hyperpolymath opens: sign in if asked, check it says **Identity published by chatgpt.com**, and press **Allow access**.
6. In a new chat, open the **+** menu (or the Developer mode tools menu) and turn on Hyperpolymath.

Some accounts instead have **Plugins → + → Add custom MCP server**; the fields are the same.

ChatGPT asks you to confirm each tool call that changes something. That's expected: Hyperpolymath's write tools (complete a task, set a reminder...) really do change your dashboard, and all of them are logged and undoable in **Activity**.

## Plans

Developer mode is offered on Plus, Pro, Business, Enterprise and Edu on the web. On Business, Enterprise and Edu an admin may need to allow it. OpenAI has at times limited write tools on some plans, so check OpenAI's help center if tools show as read-only.

## Then

Add the standing prompt from [`STANDING-PROMPT.md`](../STANDING-PROMPT.md) to your custom instructions (or a project's instructions) so ChatGPT starts with `get_overview` and follows the house rules.

## Troubleshooting

- ChatGPT has no field for a pasted bearer token, so use OAuth.
- Your app must be reachable on the public internet; ChatGPT can't reach `localhost`.
- To disconnect, delete the app in ChatGPT, or press **Disconnect** under **Settings → Connections → Connected apps** in Hyperpolymath.
