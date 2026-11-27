# Contributing

Thanks for helping. Hyperpolymath is deliberately small, so the best contributions keep it that way.

## Before you start

- Read [`docs/PLAN.md`](docs/PLAN.md) for the architecture and roadmap.
- For anything bigger than a bug fix, open an issue first so we can agree on the shape.
- Security problems go through private reporting, not issues: see [`SECURITY.md`](SECURITY.md).

## Setup

```bash
pnpm install
cp .env.example .env.local   # your own Supabase project
pnpm dev
```

Use Node 22 or newer. This is Next.js 16, which changed a lot: check `node_modules/next/dist/docs/` before relying on what you remember about Next.

## The rules that matter

1. **One service layer, two front doors.** All reads and writes go through `src/server/*`. Server Actions (`src/app/actions/*`) and the MCP server (`src/server/mcp.ts`) are thin wrappers. The browser never writes to Supabase.
2. **Scope every query by `user_id`.** Services use the secret key, which bypasses row-level security.
3. **Every write is logged.** Services call `logAction` with before and after snapshots. A new entity type needs handling in `revertAction` (`src/server/log.ts`).
4. **Schema changes are migrations.** Add a new file to `supabase/migrations/` (never edit an applied one), enable RLS on new tables, and regenerate `src/lib/database.types.ts`.
5. **Widgets are data.** New widget kinds get a payload schema in `src/lib/widgets.ts`. Bots never supply code or HTML.
6. **Stay small.** No UI kits, no background AI on writes, no new dependency without a good reason.
7. **The repo is public.** No secrets, personal data or real-account seed data, in code, tests, fixtures or screenshots.

## Pull requests

- Branch from `dev` and open the PR against `dev`.
- Keep commits atomic with [conventional](https://www.conventionalcommits.org) messages (`feat(tasks): ...`, `fix(tick): ...`).
- Run the gates before pushing; CI runs them too:
  ```bash
  pnpm typecheck && pnpm lint && pnpm test && pnpm build
  ```
- Add tests for logic you change. Pure helpers get unit tests next to them; service behavior gets a case in `src/server/integration.test.ts`.
- UI copy and docs: plain, short sentences, and no em dashes.

By contributing you agree your work is released under the [MIT License](LICENSE).
