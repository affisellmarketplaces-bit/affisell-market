# Affisell Environments — Zero Downtime

Safe workflow: **local dev** never silently hits production; **Vercel Preview** uses Neon staging branch (`ep-shy-wind-…`); **Production** uses Neon main (`ep-misty-sea-…`).

> Cohérence documentaire (finalisation master K1/J2) : les règles de **schéma et de déploiement** de ce fichier sont celles de `AGENTS.md` et de
> `docs/DEPLOY-SCHEMA-CHANGES.md` (elles font foi en cas de divergence). `prisma migrate dev`, `prisma db push`, `npm run db:migrate*` et `npm run migrate:deploy`
> ne s'utilisent **jamais** sur cette base. Isolation Preview / Production : section « Isolation » ci-dessous. Réglages côté services : `docs/EXTERNAL-OPS-RUNBOOK.md`.
> Sauvegarde et restauration : `docs/BACKUP-RESTORE.md`.

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

The full per-environment list (database, Stripe, Redis, encryption keys, Sentry, storage, webhooks, what must be **absent** from Preview) is in
`docs/EXTERNAL-OPS-RUNBOOK.md` §2; the application checks it at startup and logs **names only** (`[env-validation]`, see « Isolation » below).

**Red guard** — Preview must not use prod DB. Three layers, all of which fail closed:

1. `env:check` (script): `⚠️  PREVIEW POINTE SUR PROD DB! Utilise DATABASE_URL_STAGING`
2. the Vercel **build** (`scripts/schema-deploy.mjs verify`) refuses a Preview whose `DATABASE_URL` / `DIRECT_URL` / `DATABASE_URL_UNPOOLED` is not provably the staging branch (exit 2);
3. **at runtime** (K1, `assertPreviewNotOnProductionDatabase` in `lib/db-env.ts`): on `VERCEL_ENV=preview`, no Prisma client — default, fulfilment **or Radar** — is created for a URL
   that names production. Every query then fails with `[env-guard]` (masked endpoint only) instead of silently serving or writing production data.

---

## Workflow: feature → Preview → main

```bash
# 1. Local branch
git checkout -b feature/my-feature

# 2. Dev against staging DB (export DATABASE_URL_STAGING in .env.local first)
npm run dev:staging
# or: npm run dev  (with DATABASE_URL pointing at shy-wind in .env.local)

# 3. Schema change? Migrate the STAGING branch by hand FIRST (a Vercel build never migrates; it only verifies):
#    DATABASE_URL='<staging url>' npm run schema:migrate -- --expect-endpoint ep-shy-wind-aly4bmc7

# 4. Push → Vercel Preview auto-build. Two SEPARATE shell commands (a `commit && push` hangs on the network inside some tools):
git commit -m "…"
npm run push:safe -- feature/my-feature   # secret scan + fetch / pull --rebase / push with timeouts. NAME the branch: with no argument the script targets `main` (production). Never a bare `git push origin main`

# 5. QA on the Preview (it runs on staging + Stripe TEST keys; check the Preview's build log: `[schema]   DATABASE_URL → ep-shy-wind-…`)
#    Do not `vercel env pull` the Production environment onto a laptop (it would make the laptop a holder of production secrets).
npm run demo:ensure   # against staging DATABASE_URL
# Login: *@demo.affisell.com + DEMO_LAB_PASSWORD

# 6. Production — a founder decision (finalisation master §0): migrate production by hand BEFORE the merge when there is a schema change
#    (DATABASE_URL='<prod url>' npm run schema:migrate -- --expect-endpoint ep-misty-sea-al1ne07p --confirm-production, then npm run schema:verify),
#    then merge the pull request into `main` on GitHub. The Production build only VERIFIES the schema and stops if it is missing.
```

---

## Prisma — safe migrations

| Command | Where | Safe? |
|---------|-------|-------|
| `DATABASE_URL='<url>' npm run schema:migrate -- --expect-endpoint <ep-id> [--confirm-production]` (= `migrate deploy` + catalogue check, hard fail) | **by hand, BEFORE the push**, with an explicit URL and the endpoint named — a Vercel build never migrates, it only runs `schema:verify` | ✅ staging and prod |
| `DATABASE_URL='<url>' npm run schema:verify` / `npm run verify:event-spine` / `npm run prisma:explicit -- status` | anywhere (session forced read-only by the server) | ✅ |
| `npx prisma migrate dev`, `npm run db:migrate:dev` | **never** — this database also holds Medusa's tables: Prisma would propose to DROP them; `prisma.config.ts` loads `.env.local` with `override: true`, so the command targets the DEFAULT database (production) whatever URL you pass | ❌ |
| `npm run db:migrate`, `npm run migrate:deploy`, `DATABASE_URL=… npx prisma migrate deploy` | **never** — same `override` trap: they hit the default database | ❌ |
| `prisma db push`, applying a `migrate diff` | **never** (same Medusa-tables reason) | ❌ |

**Rule:** a schema change is an **explicit, hand-written SQL migration**, additive (nullable columns, new tables, new indexes), without `IF NOT EXISTS` to mask drift. Never `db push`,
never `migrate dev` — on any database of this project, staging included.

1. Write the migration SQL by hand under `prisma/migrations/<timestamp>_<name>/` and update `prisma/schema.prisma` to match (a test compares them: `lib/__tests__/events-migration.test.ts` is the model). `prisma migrate diff --help`
   can produce a **draft** between two schema files (no database involved) — review it, never apply it.
2. Migrate the STAGING branch by hand (`DATABASE_URL=<staging> npm run schema:migrate -- --expect-endpoint ep-shy-wind-aly4bmc7`), then push the PR → the Preview build only VERIFIES (a Preview that points at production is refused)
3. Migrate production by hand (`schema:migrate -- --expect-endpoint ep-misty-sea-al1ne07p --confirm-production`), **then** merge `main` → the Production build only VERIFIES and STOPS the deployment if the schema is not there (see `docs/DEPLOY-SCHEMA-CHANGES.md`)

```bash
DATABASE_URL='<url>' npm run prisma:explicit -- status   # pending / failed migrations (read-only)
DATABASE_URL='<url>' npm run schema:verify               # target + catalogue check (read-only)
npm run env:check                                        # which environment / database this shell would use
```

(`npm run db:check` runs `prisma db pull --print` through the config that loads `.env.local`: it **reads** the DEFAULT database, possibly production. Read-only, but not a staging check.)

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
| **Vercel** | Dashboard → Deployments → Promote previous Production deployment (Instant Rollback) |
| **DB — schema** | Neon **does not** auto-rollback a migration — fix with a new **forward** migration; a FAILED migration is `resolve --rolled-back` only (`docs/DEPLOY-SCHEMA-CHANGES.md` §6), there is deliberately no `--applied` |
| **DB — data** | Point-in-time restore on the SAME Neon branch (keeps the `ep-misty-sea-…` endpoint, so no variable changes) — `docs/BACKUP-RESTORE.md` |
| **Feature flag** | Set `NEXT_PUBLIC_FF_*=0` on Production → redeploy (no code revert needed) |
| **Git** | `git revert <commit>` on `main` → push (triggers new prod deploy) |

Never restore prod DB from staging branch. Rolling the code back does not roll the database back.

---

## Commands cheat sheet

```bash
npm run env:check          # load .env.local + .env, print env line
npm run dev                # env check → Prisma → Next :3001
npm run dev:staging        # DATABASE_URL=$DATABASE_URL_STAGING npm run dev
npm run db:branch          # Neon branch setup reminder
npm run db:check           # env + prisma db pull --print (READS the default database — possibly production)
npm run demo:ensure        # idempotent demo accounts (use staging URL)
npm run schema:verify      # (with DATABASE_URL='<url>') read-only schema check — replaces the old db:migrate:status
```

Not in this list on purpose: `db:migrate`, `db:migrate:dev`, `db:migrate:status`, `migrate:deploy`, `db:push` (they load `.env.local` with `override: true` and target the default database — AGENTS.md).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `DB=(unset)` | Create `.env.local` from `.env.local.example`, set `DATABASE_URL` |
| Preview hits prod data | Preview `DATABASE_URL` → `ep-shy-wind-…` |
| `env:check` exit 1 on CI Preview sim | Expected when simulating prod URL on preview |
| P1002 migration lock | Use `DATABASE_URL_UNPOOLED` (direct host, not `-pooler`) — then `docs/DEPLOY-SCHEMA-CHANGES.md` §6 (`db:unlock` is a read-only diagnostic by default) |
| `[env-guard] … Preview … PRODUCTION database` | the Preview's `DATABASE_URL` / `DATABASE_URL_UNPOOLED` / `DIRECT_URL` / `RADAR_DATABASE_URL` / `MARKET_INTELLI_DATABASE_URL` names production → point it at staging or remove it, redeploy |
| `[stripe-guard] live_key_refused` | a `sk_live_…` / `rk_live_…` key is configured outside production → put the Stripe TEST key in that environment (the guard has no override on Vercel) |
| `[env-validation] result: "critical"` | read `critical` and `variables` (names only) in that log line; each id is explained in `lib/env-validation.ts`; fix in Vercel → Environment Variables, redeploy |
| `[proxy] auth_secret_missing_on_request` | no `AUTH_SECRET` / `NEXTAUTH_SECRET` on this environment: nobody can sign in and protected pages redirect to the login |
| Production worker consumes nothing after the K1 change (`redis_namespace_not_production` in its log / in Slack) | its host resolves to the `dev:` namespace → set `NODE_ENV=production` (preferred) or `AFFISELL_REDIS_NAMESPACE=production` on the worker (see « Isolation », Redis) |
| Sentry shows an environment `unknown` | a build without Vercel's signal (not a Vercel deployment, or `VERCEL_ENV` stripped) — never filed under `production` on purpose |

Humanoid Shield stays active in all environments (`[shield] ALLOW` on normal routes).

---

## Isolation Preview / Production (finalisation master K1)

Until K1 only the **database** was isolated between Preview and Production. `NODE_ENV` is `production` on a Preview too, so everything keyed on it treated a Preview as production. Now `VERCEL_ENV` decides
(`lib/runtime-environment.ts`); what changed, per shared resource:

| Resource | Before | Now | Test |
|---|---|---|---|
| **Sentry** `environment` | `NODE_ENV` → a Preview error was filed under `production` | `VERCEL_ENV`: `production` / `preview` / `development`; `unknown` when there is no Vercel signal (never `production` without proof); the browser bundle gets `NEXT_PUBLIC_VERCEL_ENV` from `next.config.ts` | `runtime-environment.test.ts` |
| **Redis** keys and **BullMQ** queues | no environment in any key (`affisell:shield:*`, `rl:*`, `bull:*`…): a Preview shared production's counters, bans, locks — and could enqueue jobs a production worker would run | `lib/redis-namespace.ts`: **production keeps the empty namespace** (no existing key changes, BullMQ keeps its default `bull` prefix), Preview → `preview:` / `preview:bull`, development → `dev:`, tests → `test:` | `redis-namespace.test.ts` (unit + an inventory that fails when a new Redis user forgets the namespace) |
| **Stripe** | a Preview could build its client with `sk_live_…` and charge real cards | `lib/stripe-key-guard.ts`: `getStripeClient` **refuses** a live key outside production; the message and log name the environment, never the key. Only escape hatch: `AFFISELL_ALLOW_LIVE_STRIPE_OUTSIDE_PRODUCTION=1`, honoured on a developer machine and **ignored on any Vercel deployment** | `stripe-key-guard.test.ts` |
| **Database** (runtime) | `previewPointsAtProdDb` was only used by scripts | `assertPreviewNotOnProductionDatabase` in `lib/prisma.ts` (default + fulfilment clients) and `lib/prisma-radar.ts` — including `RADAR_DATABASE_URL` / `MARKET_INTELLI_DATABASE_URL` | `preview-database-guard.test.ts` |
| **Environment variables** | a missing `AUTH_SECRET` / `STRIPE_WEBHOOK_SECRET` was noticed by customers | `lib/env-validation.ts` at server start (`instrumentation.ts`): one `[env-validation]` line, **names only**, critical findings also sent to Sentry; nothing during `next build`; an `[proxy] auth_secret_missing_on_request` ERROR (≤ 1/min/instance) when the proxy has no session secret | `env-validation.test.ts`, `proxy-session-token.test.ts` |

### Redis transition — what to do, and the one trap

- **Production data**: nothing to migrate and nothing to flush — production's keys are exactly what they were. A rollback of this change leaves production untouched.
- **Preview**: its keys now live under `preview:…`. Anything a Preview wrote into the production namespace *before* K1 cannot be told apart from production's and is left alone (counters/caches: harmless).
  Best isolation is still a **separate Upstash instance for Preview** (`docs/EXTERNAL-OPS-RUNBOOK.md` U1): the namespace is a software safety net, not a boundary.
- **The trap — a worker outside Vercel**: `workers/auto-order-worker.ts` (`npm run worker:auto-order`) resolves its namespace from its own environment. On a host that does **not** set `NODE_ENV=production` it would listen on `dev:bull:*` while Vercel Production
  enqueues on `bull:*` — nothing is consumed and nothing errors. Set `NODE_ENV=production` (preferred: it is also what lets a live Stripe key run in that process — the guard judges the runtime environment) **or** `AFFISELL_REDIS_NAMESPACE=production` (Redis only; honoured off Vercel, ignored on a Vercel Preview / Development deployment). The worker now says so itself at start: an info line `[auto-order-worker] redis_namespace` with the namespace and BullMQ prefix it uses, and — when that namespace is not production and was not chosen explicitly — an ERROR line `redis_namespace_not_production` plus a Slack / Discord alert (it does not exit: a visible alert beats a crash loop). Read that line after every worker deploy.
  A worker that must serve Preview's queues: `AFFISELL_REDIS_NAMESPACE=preview`. A worker started from a laptop now lands in `dev:`, which is one more reason it cannot consume production's queues by accident (the existing `assertNotProductionByAccident` guard stays).
- Radar variables: `RADAR_DATABASE_URL` / `MARKET_INTELLI_DATABASE_URL` must be **absent or staging** on Preview (a URL naming production is refused at runtime and flagged by `[env-validation]`; a separate non-Neon-production Radar database cannot be recognised as production by hostname — keep it out of Preview).
