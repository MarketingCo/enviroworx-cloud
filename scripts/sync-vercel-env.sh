#!/usr/bin/env bash
# Sync required env vars from .env.local → Vercel (production + preview).
# Usage: ./scripts/sync-vercel-env.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env.local ]]; then
  echo "Missing .env.local — copy from .env.local.example first."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.local
set +a

add_env() {
  local name="$1"
  local value="$2"
  local env="${3:-production}"
  if [[ -z "${value:-}" ]]; then
    echo "skip $name (empty in .env.local)"
    return
  fi
  echo "→ $name ($env)"
  vercel env add "$name" "$env" --value "$value" --yes --force 2>/dev/null || \
    vercel env add "$name" "$env" --value "$value" --yes --force
  vercel env add "$name" preview --value "$value" --yes --force 2>/dev/null || true
}

SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-${API_KEY:-}}"
add_env SUPABASE_SERVICE_ROLE_KEY "$SERVICE_KEY"
add_env SESSION_SECRET "${SESSION_SECRET:-${PIN_SECRET:-${CRON_SECRET:-}}}"
add_env OFFICE_GOOGLE_ALLOWED_DOMAINS "${OFFICE_GOOGLE_ALLOWED_DOMAINS:-enviroworx.co.uk}"
add_env NEXT_PUBLIC_APP_URL "${NEXT_PUBLIC_APP_URL:-https://enviroworx-cloud.vercel.app}"
add_env GOOGLE_MAPS_API_KEY "${GOOGLE_MAPS_API_KEY:-}"
add_env NEXT_PUBLIC_GOOGLE_MAPS_API_KEY "${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:-}"
add_env TWILIO_ACCOUNT_SID "${TWILIO_ACCOUNT_SID:-}"
add_env TWILIO_AUTH_TOKEN "${TWILIO_AUTH_TOKEN:-}"
add_env TWILIO_FROM_NUMBER "${TWILIO_FROM_NUMBER:-}"

echo ""
echo "Done. Redeploy: vercel --prod"
echo "Then: node scripts/preflight-check.mjs"
