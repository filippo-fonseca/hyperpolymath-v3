# Other clients

Anything that speaks remote MCP (Streamable HTTP) can connect to `https://<your-app>/api/mcp`.

## Clients with OAuth sign-in

Cursor, VS Code, Windsurf, MCP Inspector and most current MCP clients discover Hyperpolymath's sign-in from the server URL alone: add the URL, start the connection, and approve in the browser. See [README.md](README.md#how-sign-in-works-for-the-curious) for the endpoints if a client asks for them.

## Clients that only send headers

Create a personal token under **Settings → Connections → Personal tokens** and send either header:

```
Authorization: Bearer hpm_...
x-api-key: hpm_...
```

Example `mcp.json` style config:

```json
{
  "mcpServers": {
    "hyperpolymath": {
      "url": "https://<your-app>/api/mcp",
      "headers": { "Authorization": "Bearer hpm_..." }
    }
  }
}
```

## Scripts

```bash
curl -s https://<your-app>/api/mcp \
  -H "Authorization: Bearer hpm_..." \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

`scripts/smoke-mcp.mjs` runs an end-to-end check with a token: `HPM_TOKEN=hpm_... node scripts/smoke-mcp.mjs https://<your-app>`.

## Quick capture

The same personal tokens work for `POST /api/capture` (see [DEPLOY.md](../DEPLOY.md#6-quick-capture-from-your-phone)).

## Every tool call names a bot

Hyperpolymath's write tools take a `bot` argument (for example `"Claude"`), which attributes the change in Activity. Tell your assistant which name to use in its instructions; [`STANDING-PROMPT.md`](../STANDING-PROMPT.md) covers it.
