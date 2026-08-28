# Affisell environments — LOCAL · STAGING · PROD

Zero-break workflow: local dev never touches production data; Preview uses a Neon **branch**; Production auto-deploys from `main`.

## Overview

| Environment | Trigger | URL | Database | Env file / Vercel |
|-------------|---------|-----|----------|-------------------|
| **LOCAL** | `npm run dev` | `http://localhost:3001` | Neon branch or Docker Postgres | `.env.local` (gitignored) |
| **STAGING** | Push feature branch | Vercel Preview (`*.vercel.app` or `staging.affisell.com`) | Neon **branch** (`DATABASE_URL_STAGING`) | Vercel → Preview env |
| **PROD** | Merge to `main` | `https://affisell.com` | Neon **main** (`DATABASE_URL`) | Vercel → Production env |

Preflight on every dev start:

```bash
npm run env:check
# [affisell env] LOCAL DB=ep-misty-sea-****.c-3.eu-central-1.aws.neon.tech branch=neondb
```

---

## LOCAL

1. Copy `.env.local.example` → `.env.local`
2. Align `PORT`, `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL` (default **3001**)
3. Set `DATABASE_URL` to:
   - **Neon branch** (recommended) — same project, isolated data, or
   - **Docker**: `npm run db:local:setup` → `postgresql://affisell:affisell@localhost:5433/affisell`

```bash
npm run dev
# [affisell dev] Affisell — preparing local dev…
# [affisell env] LOCAL DB=ep-misty-sea-****… branch=neondb
# [affisell dev] Prisma clients ready
```

Humanoid Shield stays active (`[shield] ALLOW` on normal routes). Never copy localhost URLs to Vercel.

---

## STAGING (Vercel Preview)

1. Create a Neon branch: **Dashboard → Branches → Create from main**
2. Copy the branch connection string → Vercel **Preview** env:
   - `DATABASE_URL` = branch URL (or alias via `DATABASE_URL_STAGING`)
   - `DATABASE_URL_STAGING` = same branch URL (reference for checks)
3. Set `AFFISELL_PROD_DB_ENDPOINT=ep-xxxx` (main prod endpoint id — **not secret**, for mismatch detection)
4. Push feature branch → Vercel builds Preview automatically

```bash
npm run db:branch   # prints Neon branch setup reminder
npm run env:check   # on Preview CI — warns if Preview DB = prod main
```

**Red warning** if Preview `DATABASE_URL` points at production main:

```
⚠️  PREVIEW pointe sur PROD DB — utilise branch!
```

Optional public URL: `NEXT_PUBLIC_APP_URL=https://staging.affisell.com` on Preview env.

---

## PRODUCTION

- Merge PR to `main` → Vercel Production deploy
- `DATABASE_URL` = Neon **main** pooled endpoint
- `DATABASE_URL_UNPOOLED` / `DIRECT_URL` = direct host (migrations, fulfillment writes)
- `NODE_ENV=production` + localhost `DATABASE_URL` → **crash** at `env:check` (safety)

Migrations: `prisma migrate deploy` via Vercel build / cron (`/api/cron/migrate`) — **never** `db push` on prod from a laptop.

---

## Recommended workflow

```
feature/xxx
  → test local (npm run dev, npm run test)
  → git push → Vercel Preview (staging DB branch)
  → QA with demo test account (*@demo.affisell.com, DEMO_LAB_PASSWORD)
  → merge main → Production auto-deploy
```

### Demo / seed data (staging)

```bash
# Same DATABASE_URL as staging branch
npm run demo:ensure
```

Creates idempotent demo users (`*@demo.affisell.com`) for client QA on Preview.

---

## Prisma rules

| Action | LOCAL | STAGING | PROD |
|--------|-------|---------|------|
| `npx prisma migrate dev` | ✅ | ❌ (use branch from main) | ❌ |
| `prisma migrate deploy` | optional | ✅ (Preview deploy) | ✅ (Vercel build/cron) |
| `prisma db push` | ✅ dev only | ❌ | ❌ **never** |

1. Write migration locally against your branch
2. Push code → Preview runs `migrate deploy`
3. Merge → Production runs `migrate deploy`

---

## Feature flags (staging first)

Public flags in `lib/flags.ts` — enable on **Preview** before Production:

| Env var | Flag |
|---------|------|
| `NEXT_PUBLIC_FF_NEW_RADAR=1` | `enableNewRadar` |
| `NEXT_PUBLIC_FF_LUXE=1` | `enableLuxe` |
| `NEXT_PUBLIC_FF_HUMANOID_SHIELD_DASHBOARD=1` | Shield admin dashboard |
| `NEXT_PUBLIC_FF_WIZARD_V2=1` | Wizard v2 |
| `NEXT_PUBLIC_FF_INSTANTSCAN=1` | InstantScan |

Set on Vercel Preview → validate → copy to Production when ready.

---

## Key environment variables

See `.env.example` (full list) and `.env.local.example` (local overrides).

| Variable | LOCAL | STAGING | PROD |
|----------|-------|---------|------|
| `DATABASE_URL` | branch / docker | Neon branch | Neon main |
| `DATABASE_URL_STAGING` | optional ref | branch URL | — |
| `DATABASE_URL_UNPOOLED` | direct branch | direct branch | direct main |
| `NEXTAUTH_URL` | `http://localhost:3001` | Preview URL | `https://affisell.com` |
| `NEXTAUTH_SECRET` | local secret | Preview secret | prod secret |
| `UPSTASH_REDIS_REST_URL` | optional | Preview | Production |
| `STRIPE_*` | test keys | test keys | live keys |
| `RESEND_*` | onboarding@resend.dev | verified domain | verified domain |
| `DEMO_LAB_PASSWORD` | `.env.local` | Preview env | `DEMO_LAB_ENABLED=1` |

---

## CI / Vercel protection

- **GitHub**: `.github/workflows/preview-check.yml` runs `npm run env:check` on PRs
- **Vercel**: enable **Deployment Protection** on Production; require PR reviews before merge to `main`
- **Production deploys**: only from `main` branch (disable auto-deploy on feature branches for Production target)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Preview writes prod data | Switch Preview `DATABASE_URL` to Neon branch |
| `env:check` crash localhost on prod | Fix Vercel Production `DATABASE_URL` |
| Dev port mismatch | `npm run verify:wizard-v2:dev` — align PORT / NEXTAUTH_URL |
| P1002 migration lock | Use `DATABASE_URL_UNPOOLED` (direct host, not pooler) |

```bash
npm run env:check
npm run git:sync
```
