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
# The CLI masks new-style secret keys, so ask the Management API to reveal them,
# authenticated with the CLI's own login token from the keychain.
TOKEN="$(security find-generic-password -s "Supabase CLI" -w)"
TOKEN="${TOKEN#go-keyring-base64:}"; [[ "$TOKEN" == sbp_* ]] || TOKEN="$(printf %s "$TOKEN" | base64 -d)"
curl -fsS -H "Authorization: Bearer $TOKEN" "https://api.supabase.com/v1/projects/$REF/api-keys?reveal=true" | python3 -c '
import json, sys
raw = sys.stdin.read()
keys, _ = json.JSONDecoder().raw_decode(raw[raw.index("["):])
def first(t):
    for k in keys:
        if k.get("type") == t: return k["api_key"]
    sys.exit(f"no {t} key found")
ref, email = sys.argv[1], sys.argv[2]
pub, sec = first("publishable"), first("secret")
lines = [
    f"NEXT_PUBLIC_SUPABASE_URL=https://{ref}.supabase.co",
    f"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY={pub}",
    f"SUPABASE_SECRET_KEY={sec}",
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
