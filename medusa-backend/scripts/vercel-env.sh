#!/usr/bin/env bash
# Push Medusa backend env vars to Vercel (production).
# Usage: MEDUSA_BACKEND_URL=https://xxx.up.railway.app ./scripts/vercel-env.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GENERATED="$ROOT/.env.generated"

MEDUSA_URL="${MEDUSA_BACKEND_URL:-}"
PUBLISHABLE_KEY="${NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY:-}"

if [[ -z "$MEDUSA_URL" && -f "$GENERATED" ]]; then
  MEDUSA_URL="$(grep -E '^MEDUSA_BACKEND_URL=' "$GENERATED" | cut -d= -f2- || true)"
fi
if [[ -z "$PUBLISHABLE_KEY" && -f "$GENERATED" ]]; then
  PUBLISHABLE_KEY="$(grep -E '^NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=' "$GENERATED" | cut -d= -f2- || true)"
fi

if [[ -z "$MEDUSA_URL" || -z "$PUBLISHABLE_KEY" ]]; then
  echo "❌ Set MEDUSA_BACKEND_URL + NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY (or run npm run setup:auto first)"
  exit 1
fi

echo "→ vercel env add MEDUSA_BACKEND_URL production"
printf '%s' "$MEDUSA_URL" | vercel env add MEDUSA_BACKEND_URL production

echo "→ vercel env add NEXT_PUBLIC_MEDUSA_BACKEND_URL production"
printf '%s' "$MEDUSA_URL" | vercel env add NEXT_PUBLIC_MEDUSA_BACKEND_URL production

echo "→ vercel env add NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY production"
printf '%s' "$PUBLISHABLE_KEY" | vercel env add NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY production

echo "✅ Vercel production env updated — redeploy affisell-market on Vercel"
