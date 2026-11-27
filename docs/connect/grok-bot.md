# Connect Grok Bot

Grok Bot can sign in with Hyperpolymath (OAuth) or send a personal token. MCP servers are account-wide in Grok Bot, so every bot shares the connection. Do this once.

## Option A: sign in (recommended)

1. In Grok Bot, open **Connect apps → Add a custom connector**.
2. Choose **Remote HTTPS**, name it `Hyperpolymath`, and paste `https://<your-app>/api/mcp`. Leave headers empty.
3. Save, then sign in on the card that appears and press **Allow access** in Hyperpolymath.

You can also ask any bot in chat: *"Add a custom MCP server named Hyperpolymath at https://&lt;your-app&gt;/api/mcp and sign in to it."*

## Option B: personal token

1. In Hyperpolymath, open **Settings → Connections → Personal tokens**, name a token "Grok Bot" and create it. Copy the `hpm_...` value; it's shown once.
2. In any bot's chat, send (Settings has this message ready to copy, with your token filled in):

   > Add a custom MCP server named "Hyperpolymath". URL: `https://<your-app>/api/mcp`. Header: `Authorization: Bearer <paste token>`. Store the token as a secret, then call get_overview to confirm it works.

## Then

Continue with [`GROKBOT-SETUP.md`](../GROKBOT-SETUP.md) to set up your coordinator (Kiwi), the Reminder relay and widgets.

## Troubleshooting

- Grok Bot's sign-in runs from its cloud, so your app must be public over HTTPS.
- Sign-in can sit on "Still signing in?" for a while; finishing the approval in Hyperpolymath completes it.
- To disconnect a signed-in Grok Bot, press **Disconnect** under **Settings → Connections → Connected apps**. To cut off a token, revoke it under **Personal tokens**.
