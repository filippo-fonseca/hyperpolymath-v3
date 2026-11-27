# App API (`/api/v1`)

A small JSON API for native clients: the iPhone app, its widgets and the Mac menu bar app in [`apple/`](../apple). Bots use MCP instead.

- **Auth:** `Authorization: Bearer hpm_…` (or `x-api-key: hpm_…`). Both **app** keys (made in **Settings → Phone and Mac**) and **full** keys work. App keys can't reach `/api/mcp`.
- **Writes** run through the same services as the dashboard and MCP, act as you, and land in the activity log, where you can revert them.
- **Errors** come back as `{"error": "…", "code": "…"}` with 400 (invalid), 401 (bad key), 403 (key can't use this API), 404 (not found), 409 (conflict) or 500.
- **Shapes** are the zod schemas in [`src/lib/app-api.ts`](../src/lib/app-api.ts). Bump `APP_API_VERSION` on a breaking change. A shared fixture in `apple/HyperpolymathKit/Tests/HyperpolymathKitTests/Fixtures/` is checked by both `src/lib/app-api.test.ts` and the Swift tests.

## Endpoints

| Method and path | Body | Returns |
| --- | --- | --- |
| `GET /api/v1/me` | | Your name, photo, timezone, and this key's name and scope. |
| `GET /api/v1/summary` | | Everything the home screen and widgets show (below). |
| `GET /api/v1/tasks?scope=today\|upcoming\|inbox\|open\|done&limit=100` | | A list of tasks. |
| `POST /api/v1/tasks` | `{"text": "Call the bank tomorrow 5pm p1 #Admin"}` | The new task. Dates, times, priority and `#Project` are parsed like the dashboard's quick add. |
| `POST /api/v1/tasks/:id/complete` | | The task. Recurring tasks come back open with their next date. |
| `POST /api/v1/tasks/:id/reopen` | | The task. |
| `POST /api/v1/habits/:id/log` | `{"progress": 0-3}` (default 3) | The habit with today's progress and streak. |
| `GET /api/v1/captures?limit=30` | | Recent captures. |
| `POST /api/v1/captures` | `{"content": "…"}` | The new capture. |
| `POST /api/v1/captures/:id/seen` | | Clears a resurfaced capture. |

## The summary

One call, so a widget refresh costs one request:

```jsonc
{
  "version": 1,
  "generated_at": "2026-11-27T14:05:09.412Z",
  "timezone": "America/New_York",
  "today": "2026-11-27",
  "profile": { "name": "Ada Lovelace", "avatar_url": null },
  "counts": { "today_open": 2, "overdue": 1, "inbox": 4, "upcoming": 1, "done_today": 3, "resurfaced": 1 },
  "tasks": { "today": [/* due today or overdue */], "upcoming": [/* next 7 days */] },
  "habits": [{ "id": "…", "name": "Swim", "icon": "🏊", "scheduled_today": true, "progress": 2, "streak": 12, "week": [/* Sun..Sat */] }],
  "captures": { "recent": [/* 12 newest */], "resurfaced": [/* back on schedule */] },
  "calendar": { "connected": true, "error": null, "events": [/* today and tomorrow */] },
  "activity": [{ "date": "2026-11-14", "tasks_done": 2, "habits_done": 1 } /* 14 days, ending today */]
}
```

`activity.tasks_done` counts completions from the action log, so finishing a recurring task counts even though the task itself rolls forward.

## Try it

```bash
curl -s https://<your-app>/api/v1/summary -H "Authorization: Bearer hpm_…" | jq .counts
curl -s https://<your-app>/api/v1/tasks -H "Authorization: Bearer hpm_…" \
  -H "content-type: application/json" -d '{"text":"Book flights friday p2"}'
```
