# Affisell Market Intelli V2 (monorepo)

This repo contains **Affisell Market** (production on Vercel) plus **Market Intelli V2** in isolated folders.

**Rule:** Market Intelli must never break Affisell Market deploys.

## Install sans casser Affisell

Affisell Market and Market Intelli are **fully isolated**:

| | Affisell Market | Market Intelli V2 |
|---|-----------------|-------------------|
| **Location** | repo root (`app/`, `lib/`, `prisma/`) | `apps/api`, `apps/web`, `packages/db` |
| **Vercel** | `npm ci` + `scripts/vercel-build.mjs` | not deployed on Affisell Vercel project |
| **npm workspaces** | **none** at root | install per-folder via `mi:install` |
| **Database** | `DATABASE_URL` (Affisell) | `MARKET_INTELLI_DATABASE_URL` (port 5434) |
| **TypeScript** | root `tsconfig.json` excludes `apps/` + `packages/` |

### Commands (Node 24)

```bash
# 1) Affisell Market only (prod parity)
nvm use
npm install              # root — do NOT use workspaces
npm run build            # optional sanity check

# 2) Market Intelli (separate install)
npm run mi:install       # packages/db + apps/api + apps/web
docker compose up -d     # Postgres Affisell :5433 + Market Intelli :5434 + Redis
npm run mi:dev
```

Copy env files:

- Affisell: `.env.local` (unchanged)
- Market Intelli DB: `packages/db/.env.example` → `packages/db/.env`
- Market Intelli API: `apps/api/.env.example` → `apps/api/.env`

> **TikTok OAuth:** verify `verify.affisell.com` in TikTok Developers before testing.

## Local infra

`docker-compose.yml` services:

- `db` — Affisell Postgres **5433**
- `marketintelli_db` — Market Intelli Postgres **5434**
- `redis` — **6379**

```bash
export MARKET_INTELLI_DATABASE_URL="postgresql://marketintelli:marketintelli@localhost:5434/marketintelli"
export REDIS_URL="redis://localhost:6379"
```

## API (NestJS) — port 3002

Env (`apps/api/.env`):

- `CLERK_SECRET_KEY`
- `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI` → `https://verify.affisell.com/auth/tiktok/callback`
- `ENCRYPTION_KEY` — 32 bytes hex (AES-256-GCM for tokens at rest)
- `MARKET_INTELLI_DATABASE_URL`
- `REDIS_URL`

Endpoints:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/tiktok/start` | Clerk Bearer | Start OAuth (state bound to userId in Redis) |
| GET | `/auth/tiktok/callback` | — | TikTok redirect; upserts encrypted `ShopConnection` |
| POST | `/webhooks/tiktok` | HMAC signature | TikTok Shop webhooks |

## Web (Next.js) — port 3010

- `NEXT_PUBLIC_MI_API_URL=http://localhost:3002`
- `/connect` → calls `/auth/tiktok/start` (requires Clerk session token)

## Token encryption

`packages/db/src/crypto.ts` exports `encryptString` / `decryptString` (AES-256-GCM).
TikTok tokens are encrypted before `ShopConnection` upsert.
