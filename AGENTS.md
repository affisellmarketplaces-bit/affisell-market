## Client components vs Prisma

- `"use client"` modules must **not** value-import `@/lib/*` files that import `@/lib/prisma` (use `*-types.ts`, `*-shared.ts`, or `import type` only).
- Run `npm run check:client-prisma` before push when touching dashboard/nav/home client UI.

## Merchant custom domains & storefront theme

- **DNS**: merchants set `CNAME` → `STORE_CNAME_TARGET` (default `cname.affisell.com`), then **Verify** in Store profile (`/dashboard/*/settings/store`).
- **Auto subdomain**: on signup, `{slug}.{AFFISELL_STORE_HOST_SUFFIX}` (default `shops.affisell.com`) — same catalog as `/shops/{slug}`; wildcard DNS on Vercel required in prod.
- **Routing**: `middleware` calls `/api/store/resolve-host` and rewrites verified hosts to `/shops/:slug` (affiliate) or `/store/supplier/:slug` (supplier). Dashboard/checkout paths redirect to the platform origin.
- **Vercel**: each verified hostname must be added under Project → Domains (or automated later) for TLS.
- **Theme**: `Store.storefrontTheme` JSON (`primary`, `accent` hex) — **Brand Studio** (`/dashboard/affiliate/brand-studio`, `/dashboard/supplier/storefront`); applied via `StorefrontThemeStyles` on public shops.
- **Vercel SSL**: after DNS verify, `POST /api/store/verify-domain` calls Vercel Projects API when `VERCEL_API_TOKEN` + `VERCEL_PROJECT_ID` are set; status in `Store.vercelDomainStatus`, polled via `GET /api/store/domain-status`.

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
- **Video Pro paywall (founder pause)**: default **paused** — suppliers can generate unlimited Veo videos without Stripe Pro. UI shows « Mode test — générations illimitées ». To **reactivate** the 3-video limit + « Passer Pro »: set Vercel env `VIDEO_PAYWALL_PAUSED=0` (see `lib/video-quota-constants.ts`).
- Before pushing: `npm run push:safe` → `node scripts/git-push-safe.mjs` (secret scan, `git fetch` / `pull --rebase` / `push` with **timeouts**, no interactive Git prompts).
- Optional hook (once per clone): `git config core.hooksPath .githooks` then `chmod +x .githooks/pre-push`.

### Pourquoi les pushs « s’interrompent » dans Cursor

Ce n’est pas un échec du commit : c’est souvent **`git pull --rebase` qui attend le réseau** (ou un prompt Git) dans une seule commande `commit && push:safe`. L’agent doit faire **deux appels shell** : d’abord `git commit`, puis `npm run push:safe` seul.

### Agent : commit + push après une correction

1. `git commit` (commande shell 1)
2. `npm run push:safe` (commande shell 2, séparée)

Puis une ligne : **Git** — Commit `abc1234` — *message* — push OK (`main`). Détail : `.cursor/rules/git-commit-after-fix.mdc`.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
