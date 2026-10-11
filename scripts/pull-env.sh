#!/usr/bin/env bash
# Writes .env.local for local development from your Supabase project, using the
# Supabase CLI (must be logged in). Secrets never leave your machine.
#
#   ./scripts/pull-env.sh [project-ref] [owner-email]
set -euo pipefail
cd "$(dirname "$0")/.."

REF="${1:-${SUPABASE_PROJECT_REF:-}}"
if [[ -z "$REF" ]]; then read -rp "Supabase project ref: " REF; fi
EMAIL="${2:-${OWNER_EMAIL:-}}"
if [[ -z "$EMAIL" ]]; then read -rp "Owner email (the only account allowed to sign in): " EMAIL; fi

umask 077
supabase projects api-keys --project-ref "$REF" -o json 2>/dev/null | python3 -c '
import json, sys
raw = sys.stdin.read()
keys, _ = json.JSONDecoder().raw_decode(raw[raw.index("["):])
def first(t):
    for k in keys:
        if k.get("type") == t: return k["api_key"]
    sys.exit(f"no {t} key found")
ref, email = sys.argv[1], sys.argv[2]
lines = [
    f"NEXT_PUBLIC_SUPABASE_URL=https://{ref}.supabase.co",
    f"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY={first(\"publishable\")}",
    f"SUPABASE_SECRET_KEY={first(\"secret\")}",
    f"OWNER_EMAIL={email}",
]
# Keep any other vars already in .env.local (e.g. KIWI_WEBHOOK_URL).
try:
    keep = [l for l in open(".env.local").read().splitlines()
            if l and l.split("=")[0] not in {x.split("=")[0] for x in lines}]
except FileNotFoundError:
    keep = []
open(".env.local", "w").write("\n".join(lines + keep) + "\n")
print("Wrote .env.local")
' "$REF" "$EMAIL"
