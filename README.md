# Hyperpolymath v3

A small, fast, one-screen life dashboard whose primary interface is a team of Grok Bot agents talking to it over MCP.

See [`docs/PLAN.md`](docs/PLAN.md) for the architecture and build plan.

## Develop

```bash
pnpm install
./scripts/pull-env.sh   # writes .env.local from your Supabase project (needs the Supabase CLI, logged in)
pnpm dev
```
