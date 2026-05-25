#!/usr/bin/env bash
# One-shot: fix .env merge + apply pending Prisma migrations (no paste issues with zsh/#).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env.local && ! -f .env ]]; then
  mv .env.local .env
  echo "Renamed .env.local → .env"
elif [[ -f .env.local && -f .env ]]; then
  echo "Note: both .env and .env.local exist; prisma.config loads both (local overrides)."
fi

node scripts/merge-env-from-backup.mjs
node scripts/prisma-with-env.mjs migrate dev
