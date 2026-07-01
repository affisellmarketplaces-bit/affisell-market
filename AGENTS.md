## Client components vs Prisma

- `"use client"` modules must **not** value-import `@/lib/*` files that import `@/lib/prisma` (use `*-types.ts`, `*-shared.ts`, or `import type` only).
- Run `npm run check:client-prisma` before push when touching dashboard/nav/home client UI.

## Merchant custom domains & storefront theme

- **DNS**: merchants set `CNAME` → `STORE_CNAME_TARGET` (default `cname.affisell.com`), then **Activate domain + SSL** in Store profile (`/dashboard/*/settings/store`) — or wait for cron auto-activation.
- **Auto subdomain**: on signup, `{slug}.{AFFISELL_STORE_HOST_SUFFIX}` (default `shops.affisell.com`) — same catalog as `/shops/{slug}`; wildcard DNS on Vercel required in prod.
- **Routing**: `middleware` calls `/api/store/resolve-host` and rewrites verified hosts to `/shops/:slug` (affiliate) or `/store/supplier/:slug` (supplier). Dashboard/checkout paths redirect to the platform origin.
- **Vercel SSL (1-click)**: `VERCEL_API_TOKEN` + `VERCEL_PROJECT_ID` → `POST /api/store/verify-domain` registers hostname + www redirect on the Affisell Vercel project. Cron `GET /api/cron/sync-store-vercel-domains` (every 30 min via GitHub Actions) auto-verifies DNS + retries pending SSL. Preflight: `npm run verify:store-domains`.
- **Theme**: `Store.storefrontTheme` JSON (`primary`, `accent` hex) — **Brand Studio** (`/dashboard/affiliate/brand-studio`, `/dashboard/supplier/storefront`); applied via `StorefrontThemeStyles` on public shops.
- **Status**: `Store.vercelDomainStatus` (`active` | `pending` | `failed` | `skipped`); polled in UI via `GET /api/store/domain-status`.

## i18n (FR / EN)

- Cookie `affisell_locale` drives UI on most routes (`/marketplace`, `/dashboard`, `/discover`, etc.).
- URL prefix `/fr` only on `/`, `/agent`, `/creators`, `/partners` — switcher updates path + cookie there.
- Elsewhere: cookie + `router.refresh()` + client `IntlAppProvider` event (`affisell:locale-change`).
- Switcher: header (public/supplier/affiliate), `app/login|signup/layout`, Pulse immersive pages (Demo Lab uses global header).

## Demo Lab (`/demo`)

- **Public**: parcours + feedback sans compte (`POST /api/demo/feedback`).
- **1-clic**: `DEMO_LAB_PASSWORD` (server) + `enterDemoLabAction` — emails `*@demo.affisell.com`.
- **Vercel Preview** (`VERCEL_ENV=preview`): Demo Lab **activé automatiquement** ; il suffit d’ajouter `DEMO_LAB_PASSWORD` sur l’env **Preview** puis redeploy.
- **Production**: `DEMO_LAB_ENABLED=1` + `DEMO_LAB_PASSWORD`, ou `DEMO_LAB_ENABLED=0` pour couper.
- Seed idempotent: `npm run demo:ensure` (même `DATABASE_URL` que le déploiement).

## Git push

- Never put real API keys in `.env.example` — use empty placeholders only (`GROQ_API_KEY=""`).
- **Video Pro paywall (founder pause)**: default **paused** — suppliers can generate unlimited Veo videos without Stripe Pro. UI shows « Mode test — générations illimitées ». To **reactivate** the 3-video limit + « Passer Pro »: set Vercel env `VIDEO_PAYWALL_PAUSED=0` + `STRIPE_PRO_PRICE_ID`, then run `npm run verify:video-paywall` before deploy.
- **Web Push**: price alerts + order shipped/delivered when buyer has opted in (`PushSubscription`). Preflight: `npm run verify:web-push` (VAPID keys + `npx prisma migrate deploy`).
- Before pushing: `npm run push:safe` → `node scripts/git-push-safe.mjs` (secret scan, `git fetch` / `pull --rebase` / `push` with **timeouts**, no interactive Git prompts).
- Optional hook (once per clone): `git config core.hooksPath .githooks` then `chmod +x .githooks/pre-push`.

### Pourquoi les pushs « s’interrompent » dans Cursor

Ce n’est pas un échec du commit : c’est souvent **`git pull --rebase` qui attend le réseau** (ou un prompt Git) dans une seule commande `commit && push:safe`. L’agent doit faire **deux appels shell** : d’abord `git commit`, puis `npm run push:safe` seul.

### Agent : commit + push après une correction

1. `git commit` (commande shell 1)
2. `npm run push:safe` (commande shell 2, séparée)

Puis une ligne : **Git** — Commit `abc1234` — *message* — push OK (`main`). Détail : `.cursor/rules/git-commit-after-fix.mdc`.

### Cursor Agent — liste « N Files »

Ce compteur **n’est pas Git** : il cumule les fichiers touchés **dans la conversation Agent en cours** (souvent 50+ sur une longue session).
Pour vérifier l’état réel : `npm run git:sync` (ou `git status`).
Pour **réinitialiser la liste** : démarre une **nouvelle conversation** Agent avant chaque nouveau lot de travail.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
