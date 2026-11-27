# Connect Claude

Works on Claude web, desktop and mobile (custom connectors are on every plan; the free plan allows one), and in Claude Code. Claude signs in with Hyperpolymath, so there is no token to copy.

## Claude (web, desktop, mobile)

1. Open **Customize → Connectors** ([claude.ai/customize/connectors](https://claude.ai/customize/connectors)).
2. Click **+ Add**, then **Add custom connector**.
3. Name it `Hyperpolymath` and paste your server URL: `https://<your-app>/api/mcp`. Click **Continue**.
4. Keep the detected sign-in settings ("Sign in now", and "Use Claude's published identity"). Click **Add**.
5. Click **Connect**. Hyperpolymath opens: sign in if asked, check it says **Identity published by claude.ai**, and press **Allow access**.
6. In a chat, turn it on from **+ → Connectors** if it isn't already.

On Team and Enterprise plans an owner adds it under **Organization settings → Connectors**, then each member clicks **Connect**.

Claude refreshes its access on its own. To disconnect, remove the connector in Claude, or press **Disconnect** under **Settings → Connections → Connected apps** in Hyperpolymath.

## Claude Code

```bash
claude mcp add --transport http hyperpolymath https://<your-app>/api/mcp
```

Then run `/mcp` inside Claude Code (or `claude mcp login hyperpolymath`) and approve in the browser. Claude Code uses a loopback address on a random port, which Hyperpolymath accepts.

Prefer a token (CI, headless machines)? Create a personal token in **Settings → Connections** and add a header instead:

```bash
claude mcp add --transport http hyperpolymath https://<your-app>/api/mcp \
  --header "Authorization: Bearer hpm_..."
```

With a header set, Claude Code won't fall back to sign-in; remove the header to use OAuth.

## Then

Add the standing prompt from [`STANDING-PROMPT.md`](../STANDING-PROMPT.md) to a Claude project's instructions (or your profile preferences) so Claude starts with `get_overview` and follows the house rules.

## Troubleshooting

- Claude connects from Anthropic's cloud (`160.79.104.0/21`), so your app must be on the public internet over standard HTTPS (port 443).
- If you change sign-in settings, remove the connector and add it again; Claude can't edit them in place.
