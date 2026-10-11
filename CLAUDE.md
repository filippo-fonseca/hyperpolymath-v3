# Hyperpolymath v3

A one-screen widget dashboard plus a database, operated mainly by Grok Bot teammates over MCP. Read `docs/PLAN.md` first, then `AGENTS.md` (Next.js 16 has breaking changes; check `node_modules/next/dist/docs/` before writing Next code).

## Architecture rules
- **One service layer, two front doors.** All reads and writes go through `src/server/*` services. Server Actions (`src/app/actions/*`, via `userCtx()`) and the MCP server (`src/server/mcp.ts`) are thin wrappers. Never write to Supabase from the browser.
- **The DB is the source of truth.** The browser only reads through RLS for Realtime, then `router.refresh()`.
- **Every write is logged.** Services call `logAction` with before/after snapshots so the activity view can revert. New entity types must be handled by `revertAction` in `src/server/log.ts`.
- **Scope every query by `user_id`.** Services use the secret key, which bypasses RLS.
- **Bots own routines; the app owns data and display.** Custom widgets are data (`src/lib/widgets.ts` payload schemas), never bot-supplied code or HTML.
- **Stay small.** No background AI on writes, no UI kits, one migration tree in `supabase/migrations/`. Regenerate `src/lib/database.types.ts` after schema changes.

## Workflow
- Work on `dev` (it deploys to production at the v3 domain). Never push to `main` without asking.
- Commit often and atomically: one logical unit per commit, explicit pathspecs, conventional messages.
- **This repo is public.** No secrets, no personal data, no real-account seed data or bot transcripts. Config comes from env vars (see `docs/DEPLOY.md`).
- Gates: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. Integration tests in `src/server/integration.test.ts` run when `.env.local` has the secret key.
- Use Node 22+ (`export PATH=/opt/homebrew/opt/node/bin:$PATH` on this machine).
- UI copy and docs: avoid em dashes.
