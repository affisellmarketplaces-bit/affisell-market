# Affisell Environments — Zero Downtime

Safe workflow: **local dev** never silently hits production; **Vercel Preview** uses Neon staging branch (`ep-shy-wind-…`); **Production** uses Neon main (`ep-misty-sea-…`).

---

## Overview

| Environment | Trigger | URL | Neon endpoint | Vercel env |
|-------------|---------|-----|---------------|------------|
| **LOCAL** | `npm run dev` | `http://localhost:3001` | staging branch or Docker | `.env.local` |
| **STAGING** | Push feature branch | Preview URL / `staging.affisell.com` | `ep-shy-wind-aly4bmc7…` | Preview |
| **PROD** | Merge `main` | `https://affisell.com` | `ep-misty-sea-al1ne07p…` | Production |

Preflight (loads `.env.local` then `.env`):

```bash
npm run env:check
# [affisell env] LOCAL | DB: ep-shy-wind-****… | Branch: staging | Pooling: no
# [affisell env] Feature flags: luxe
```

Branch detection (hostname):

| Host contains | Branch |
|---------------|--------|
| `shy-wind` | **staging** |
| `misty-sea` | **production** |
| `localhost` | **local** |

---

## Neon branches

| Branch | Endpoint | Use |
|--------|----------|-----|
| **main** (prod) | `ep-misty-sea-al1ne07p.c-3.eu-central-1.aws.neon.tech` | Vercel **Production** `DATABASE_URL` only |
| **staging** | `ep-shy-wind-aly4bmc7.c-3.eu-central-1.aws.neon.tech` | Vercel **Preview** + optional local `dev:staging` |

Neon Dashboard → **Branches** → staging created from main → copy connection string.

---

## Vercel env vars mapping

| Variable | Production | Preview | Local (`.env.local`) |
|----------|------------|---------|----------------------|
| `DATABASE_URL` | `ep-misty-sea-…` (pooler OK) | `ep-shy-wind-…` (**not** prod!) | staging or prod read-only dev |
| `DATABASE_URL_STAGING` | — | `ep-shy-wind-…` (reference) | same as staging branch |
| `DATABASE_URL_UNPOOLED` | direct `ep-misty-sea-…` | direct `ep-shy-wind-…` | migrations / fulfillment |
| `NEXTAUTH_URL` | `https://affisell.com` | Preview URL | `http://localhost:3001` |
| `NEXT_PUBLIC_APP_URL` | `https://affisell.com` | Preview / staging domain | `http://localhost:3001` |
| `NEXT_PUBLIC_FF_*` | after Preview QA | enable first | optional |

**Red guard** — Preview must not use prod DB:

```
⚠️  PREVIEW POINTE SUR PROD DB! Utilise DATABASE_URL_STAGING
```

---

## Workflow: feature → Preview → main

```bash
# 1. Local branch
git checkout -b feature/my-feature

# 2. Dev against staging DB (export DATABASE_URL_STAGING in .env.local first)
npm run dev:staging
# or: npm run dev  (with DATABASE_URL pointing at shy-wind in .env.local)

# 3. Push → Vercel Preview auto-build
git push origin feature/my-feature

# 4. Optional: link Preview env
vercel env pull .env.preview --environment=preview
vercel --prod=false   # inspect latest preview deployment

# 5. QA on Preview with demo account
npm run demo:ensure   # against staging DATABASE_URL
# Login: *@demo.affisell.com + DEMO_LAB_PASSWORD

# 6. Merge → Production auto-deploy
git checkout main
git merge feature/my-feature
git push origin main
```

---

## Prisma — safe migrations

| Command | Where | Safe? |
|---------|-------|-------|
| `npx prisma migrate dev` | **LOCAL** only (staging branch) | ✅ |
| `prisma migrate deploy` | Vercel build / cron | ✅ prod |
| `prisma db push` | local experiments | ❌ never prod |

**Rule:** never `db push` on production from a laptop.

1. Write migration locally on **staging branch** (`migrate dev`)
2. Push PR → Preview runs `migrate deploy`
3. Merge `main` → Production `migrate deploy` (via `scripts/vercel-build.mjs` + cron)

```bash
npm run db:migrate:dev      # local — staging branch
npm run db:migrate:status   # check pending
npm run db:check            # env:check + schema peek
```

---

## Feature flags

Set on **Preview** first (`lib/flags.ts`):

| Env var | Default in `.env.example` |
|---------|---------------------------|
| `NEXT_PUBLIC_FF_NEW_RADAR` | `0` |
| `NEXT_PUBLIC_FF_LUXE` | `1` |
| `NEXT_PUBLIC_FF_HUMANOID_SHIELD_DASHBOARD` | on unless `0` |
| `NEXT_PUBLIC_FF_WIZARD_V2` | off until `1` |
| `NEXT_PUBLIC_FF_INSTANTSCAN` | off until `1` |

`npm run env:check` lists active flags.

---

## Test as client on staging

1. Vercel Preview env: `DEMO_LAB_PASSWORD` + `DATABASE_URL=ep-shy-wind-…`
2. Seed demo users on staging branch:

```bash
DATABASE_URL="$DATABASE_URL_STAGING" npm run demo:ensure
```

3. Open Preview URL → Demo Lab or login `buyer@demo.affisell.com`
4. Run checkout / supplier flows — **no impact on prod clients**

---

## Rollback

| Layer | Action |
|-------|--------|
| **Vercel** | Dashboard → Deployments → Promote previous Production deployment |
| **DB** | Neon **does not** auto-rollback — revert migration with new forward migration only |
| **Feature flag** | Set `NEXT_PUBLIC_FF_*=0` on Production → redeploy (no code revert needed) |
| **Git** | `git revert <commit>` on `main` → push (triggers new prod deploy) |

Never restore prod DB from staging branch.

---

## Commands cheat sheet

```bash
npm run env:check          # load .env.local + .env, print env line
npm run dev                # env check → Prisma → Next :3001
npm run dev:staging        # DATABASE_URL=$DATABASE_URL_STAGING npm run dev
npm run db:branch          # Neon branch setup reminder
npm run db:check           # env + prisma db pull --print
npm run demo:ensure        # idempotent demo accounts (use staging URL)
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `DB=(unset)` | Create `.env.local` from `.env.local.example`, set `DATABASE_URL` |
| Preview hits prod data | Preview `DATABASE_URL` → `ep-shy-wind-…` |
| `env:check` exit 1 on CI Preview sim | Expected when simulating prod URL on preview |
| P1002 migration lock | Use `DATABASE_URL_UNPOOLED` (direct host, not `-pooler`) |

Humanoid Shield stays active in all environments (`[shield] ALLOW` on normal routes).
