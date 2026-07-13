# Affisell Market Intelli V2 (monorepo)

This repo now contains **Affisell Market** (existing Next.js app) plus a new **Market Intelli V2** stack.

## Local prerequisites

- Node 24
- Docker (Postgres + Redis)

## Install & run (local)

Market Intelli is **not** wired into Affisell's Vercel deploy (no npm workspaces at root).
Install each package separately:

```bash
nvm use
npm run clean          # root Affisell only
npm install            # Affisell Market (root)
npm run mi:install     # Market Intelli apps + db package
docker compose up -d
npm run mi:dev
```

> Note: the domain `verify.affisell.com` must be verified in **TikTok Developers / TikTok Shop** before testing OAuth.

## Local infra (Postgres + Redis)

```bash
docker compose up -d
```

### Market Intelli DB

`docker-compose.yml` provisions `marketintelli_db` on port **5434**.

Set:

```bash
export MARKET_INTELLI_DATABASE_URL="postgresql://marketintelli:marketintelli@localhost:5434/marketintelli"
export REDIS_URL="redis://localhost:6379"
```

## Apps

### API (NestJS)

```bash
npm run mi:dev
```

Env required for `apps/api`:

- `CLERK_SECRET_KEY`
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI` (default: `https://verify.affisell.com/auth/tiktok/callback`)
- `ENCRYPTION_KEY` (32 bytes hex) — encrypt tokens at rest
- `MARKET_INTELLI_DATABASE_URL`
- `REDIS_URL`

Endpoints:

- `GET /auth/tiktok` → redirects to TikTok authorize URL
- `GET /auth/tiktok/callback` → exchanges code for token (persists encrypted connection)
- `POST /webhooks/tiktok` → webhook receiver (HMAC signature verified)

### Web (Next.js 14)

The web app runs on port **3010**.

Set:

- `NEXT_PUBLIC_MI_API_URL="http://localhost:3002"`

Open:

- `/connect` → starts TikTok OAuth

