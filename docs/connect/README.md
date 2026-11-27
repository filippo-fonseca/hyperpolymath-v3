# Connect an assistant

Hyperpolymath is operated by AI assistants over [MCP](https://modelcontextprotocol.io). Any assistant that supports remote MCP servers can read and write your dashboard: tasks, habits, reminders, captures, projects, widgets and your calendar. Every change it makes is logged in **Activity**, where you can undo it.

Your server address is always:

```
https://<your-app>/api/mcp
```

You'll find it, ready to copy, in **Settings → Connections**.

## Pick your assistant

| Assistant | How it signs in | Guide |
|---|---|---|
| Claude (web, desktop, mobile, Claude Code) | Sign in with Hyperpolymath (OAuth) | [claude.md](claude.md) |
| ChatGPT | Sign in with Hyperpolymath (OAuth) | [chatgpt.md](chatgpt.md) |
| Grok Bot | Sign in (OAuth) or a personal token | [grok-bot.md](grok-bot.md) |
| Anything else (Cursor, scripts, Shortcuts...) | OAuth if supported, otherwise a personal token | [other-clients.md](other-clients.md) |

After connecting, paste the standing prompt from [`STANDING-PROMPT.md`](../STANDING-PROMPT.md) into your assistant's instructions (Claude project instructions, ChatGPT custom instructions, or the Grok Bot description) so it knows how to use Hyperpolymath well.

## Two ways in

**Sign-in (OAuth 2.1), recommended.** You paste the server address into the assistant. It discovers Hyperpolymath's sign-in screen on its own, you approve it once, and it receives short-lived access tokens it refreshes by itself. You never copy a secret, and you can disconnect it any time under **Settings → Connections → Connected apps**.

**Personal tokens.** For clients that can only send a fixed header. Create one under **Settings → Connections → Personal tokens** (it starts with `hpm_` and is shown once), and send it as `Authorization: Bearer hpm_...` (or `x-api-key: hpm_...`). The same tokens work for the quick-capture endpoint. Revoke one any time.

Both kinds work side by side, so existing setups keep working.

## What the approval screen shows

When an assistant asks to connect, Hyperpolymath shows:

- **Who is asking.** If the app publishes its identity at a web address (Claude and ChatGPT do), you'll see that domain with a check mark. Otherwise you'll see the name the app gave itself, with a reminder to continue only if you just started connecting it.
- **Where you'll be sent back to** (for example `claude.ai`).
- **What it can do**, and that every change is logged and undoable.

If you didn't start the connection yourself, press **Cancel**.

## How sign-in works (for the curious)

Hyperpolymath is its own OAuth 2.1 authorization server, following the [MCP authorization spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization):

| Piece | Where |
|---|---|
| Protected resource metadata (RFC 9728) | `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/api/mcp` |
| Authorization server metadata (RFC 8414) | `/.well-known/oauth-authorization-server` |
| Client registration (RFC 7591) | `POST /api/oauth/register` |
| Client ID Metadata Documents | `client_id` may be an https URL to the client's metadata (Claude and ChatGPT use this) |
| Approval screen | `/oauth/authorize` |
| Tokens | `POST /api/oauth/token` (authorization code with PKCE S256, refresh token) |
| Revocation (RFC 7009) | `POST /api/oauth/revoke` |

Details worth knowing:

- Every client is public and must use PKCE with S256. Authorization responses include `iss` (RFC 9207).
- Access tokens (`hpo_...`) last one hour and are bound to this server's `/api/mcp` URL. Refresh tokens (`hpr_...`) last 60 days, are single use, and rotate on every refresh. Replaying a spent refresh token or authorization code revokes that connection.
- Only SHA-256 hashes of codes and tokens are stored. Unused registrations and expired tokens are cleaned up daily.
- Redirect URIs must be https, an `http://localhost` or `http://127.0.0.1` loopback address (any port, per RFC 8252), or an app scheme like `cursor://`.
- The single scope is `mcp` (full access to your dashboard through the tools). `offline_access` is listed so clients ask for refresh tokens.
- An unauthenticated MCP request gets `401` with `WWW-Authenticate: Bearer resource_metadata="..."`, which is how clients find all of the above.

## Troubleshooting

- **"This app couldn't be identified" or "This sign-in link doesn't look right."** The assistant's registration is missing or its return address doesn't match. Remove the connector in the assistant and add it again.
- **The assistant says it's disconnected.** You (or a token replay) revoked it. Reconnect from the assistant.
- **Server must be public.** Claude, ChatGPT and Grok Bot connect from their own clouds, so `localhost` won't work. Use your deployed URL.
