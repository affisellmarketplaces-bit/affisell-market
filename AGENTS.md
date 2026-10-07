## Client components vs Prisma

- `"use client"` modules must **not** value-import `@/lib/*` files that import `@/lib/prisma` (use `*-types.ts`, `*-shared.ts`, or `import type` only).
- Run `npm run check:client-prisma` before push when touching dashboard/nav/home client UI.

## Local dev (port 3001)

- `npm run dev` → `scripts/next-dev-port.mjs` (default **3001**, next free port if busy).
- Copy `.env.local.example` → `.env.local`: align `PORT`, `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`.
- Helpers: `lib/dev-localhost-url.ts`, `scripts/dev-localhost-url.mjs`; `npm run dev:url` / `dev:open:wizard-v2`.
- **Zsh:** quote `?query` URLs or use npm open scripts — unquoted `?wizard=v2` triggers glob errors.
- Wizard v2: `npm run verify:wizard-v2:dev` (env preflight) · `npm run test:wizard:v2` (preflight + unit tests).

## Merchant custom domains & storefront theme

- **DNS**: merchants set `CNAME` → `STORE_CNAME_TARGET` (default `cname.affisell.com`), then **Activate domain + SSL** in Store profile (`/dashboard/*/settings/store`) — or wait for cron auto-activation.
- **Auto subdomain**: on signup, `{slug}.{AFFISELL_STORE_HOST_SUFFIX}` (default `shops.affisell.com`) — same catalog as `/shops/{slug}`; wildcard DNS on Vercel required in prod.
- **Subdomain HTTPS is decided by a real TLS handshake, not by Vercel's flag** (`lib/store-subdomain-reachability.ts`, applied in `lib/store-subdomain-provisioning.ts` and the 30-min cron). `Store.subdomainVercelStatus` can be `unreachable` = Vercel says configured but a browser cannot open it; the public URL then stays on `/shops/{slug}` and recovers by itself once the handshake works. A network blip (timeout/reset) never flips a status. Probe runs in production only (`AFFISELL_SUBDOMAIN_PROBE=0|1` to force). Diagnose: `npm run verify:store-domains` (add `-- <slug>` for one store).
- **Known infra constraint (Cloudflare)**: Cloudflare's free Universal SSL covers `affisell.com` and `*.affisell.com` only — **not** `{slug}.shops.affisell.com` (two labels) → `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`. Fix: order an Advanced Certificate for `shops.affisell.com` + `*.shops.affisell.com` (SSL mode "Full"), or set the `*.shops` DNS record to DNS-only → `cname.vercel-dns.com` (Vercel then certifies each store host).
- **Routing**: `middleware` calls `/api/store/resolve-host` and rewrites verified hosts to `/shops/:slug` (affiliate) or `/store/supplier/:slug` (supplier). Dashboard/checkout paths redirect to the platform origin.
- **Vercel SSL (1-click)**: `VERCEL_API_TOKEN` + `VERCEL_PROJECT_ID` → `POST /api/store/verify-domain` registers hostname + www redirect on the Affisell Vercel project. Cron `GET /api/cron/sync-store-vercel-domains` (every 30 min via GitHub Actions) auto-verifies DNS + retries pending SSL. Preflight: `npm run verify:store-domains`.
- **Theme**: `Store.storefrontTheme` JSON (`primary`, `accent` hex) — **Brand Studio** (`/dashboard/affiliate/brand-studio`, `/dashboard/supplier/storefront`); applied via `StorefrontThemeStyles` on public shops.
- **Status**: `Store.vercelDomainStatus` (`active` | `pending` | `failed` | `skipped`); polled in UI via `GET /api/store/domain-status`.
- **Smart header** (live `/shops/{slug}` only — `StorefrontBuyerChrome smartHeader`, Brand Studio preview keeps the plain header): `position: sticky` can't work there (the header's container is as tall as the header; mobile html/body are `overflow-x: hidden`), so the header is `fixed` + an in-flow spacer of the same height (zero layout shift). Away while reading down, back as a compact bar (trust rail folded via `[data-chrome-rail]` in `globals.css`) on the way up, full again near the top; stays visible while the menu is open or focus is inside it; `prefers-reduced-motion` keeps the static header. Mobile-browser hardening: scroll offsets past the real end of the page (iOS rubber-band) and scroll shifts that follow a viewport resize (iOS toolbar collapse, rotation) are never read as a scroll direction. Pure logic + tests: `lib/storefront/header-mode.ts`; hooks: `hooks/use-header-mode.ts`.

## Listing readiness — product safety (GPSR) & identity

- **One definition of "ready to publish"** for a physical product: `lib/listing-compliance/evaluate.ts` (pure, shared by the API and the forms). Checks PRESENCE/FORMAT of the declared data, never its truth: manufacturer name / address / email / country, an **EU responsible person when the manufacturer is outside the EU**, GTIN check digit; brand and missing GTIN are advisory only. Digital goods are out of scope.
- **Rollout switch `LISTING_READINESS_MODE`** = `off` | `warn` (**default**) | `enforce`, read per request (flip it on Vercel, no code deploy). `warn` only logs `[listing-readiness]` lines (what WOULD be refused); `enforce` answers **422 `listing_not_ready`** with language-neutral codes, before anything is written. It applies to **new publications only** (create live, draft → live, CSV rows): drafts and edits of listings that are already live are never blocked, so legacy listings stay editable. Wired in `POST /api/supplier/products`, `PUT /api/supplier/products/[id]`, `POST /api/supplier/bulk-import/commit` (helper `lib/listing-compliance/gate.server.ts`, never throws).
- **Before flipping to `enforce`**: run `npm run report:listing-readiness` (READ-ONLY; uses the DATABASE_URL of `.env.local` — possibly production) and watch the `[listing-readiness] result: would_refuse_if_enforced` logs. Every UI must be able to comply first: classic form (section "Identité et sécurité"), guided wizard, CSV template columns (`manufacturer_*`, `eu_rep_*`, `gtin`). Not covered by the gate (observe-only, to do): automated imports / integration sync that create products without a supplier action.
- **Storage = `ProductAttribute` rows with reserved keys** (`lib/listing-compliance/keys.ts`: `brand`, `ean`, `mpn`, `gtin_exempt`, `gpsr_*`), **not new columns on `Product`**: `prisma migrate deploy` is warn-only in the Vercel build, so a column on the hottest table could reach production code before the database has it. The only new table, `SupplierComplianceProfile` (the supplier's reusable manufacturer / EU-rep defaults), is isolated and accessed defensively (`profile.server.ts`: a missing table = "no profile", never a crash).
- **The profile is a default to OFFER, never applied silently**: a dropshipper is rarely the manufacturer, so each product still carries — and the supplier still confirms — its own values (one-click prefill buttons in `GpsrFields`). Settings page: `/dashboard/supplier/settings/compliance`.
- **`managedAttributeKeys`**: `PUT /api/supplier/products/[id]` replaces the whole attribute set with what the form sends; a form only knows its category's attributes, so saving used to delete everything else (guided-wizard manufacturer / material / dimensions). A form now declares the keys it owns and the rest is preserved (`mergeManagedProductAttributes`). Without the declaration the legacy contract is unchanged.
- **Buyer-facing labels are translated from the KEY** (`productSpecs.keys.*`, `lib/listing-compliance/spec-labels.ts`): rows were stored with the French label the wizard wrote. Regulatory rows are excluded from product highlights (`highlight: false`).
- **Duplicates** (`GET /api/supplier/products/duplicate-check`): the supplier's OTHER products with the same GTIN, main photo or name — advisory only; other suppliers' products are never considered.
- **Hydration**: the country `<select>` is filled only after hydration (`useHydrated`): ICU country names/sort order differ between Node and the browser and caused a React hydration mismatch.

## Ship to panel — city autocomplete

- Buyer types a city in the "Ship to" panel (`components/marketplace/ShipToLanguagePanel.tsx`), gets live suggestions via `/api/geo/city-suggest` → `lib/city-suggest.ts`. Display/personalization only — no city-level shipping field on `Product`, so it never filters the catalog (only the country does).
- Default provider: **Photon** (free OSM geocoder, no key). Set `GOOGLE_PLACES_API_KEY` to switch to Google Places (New) Autocomplete instead — better postcode/typo handling, paid beyond Google's free monthly credit. No other code change needed.

## i18n (FR / EN)

- Cookie `affisell_locale` drives UI on most routes (`/marketplace`, `/dashboard`, `/discover`, etc.).
- URL prefix `/fr` only on `/`, `/agent`, `/creators`, `/partners` — switcher updates path + cookie there.
- Elsewhere: cookie + full navigation (`window.location.replace`) so server + client next-intl remount with the selected locale.
- Switcher: header (public/supplier/affiliate), `app/login|signup/layout`, Pulse immersive pages, Légion `@username` vitrines.
- Buyer chrome wired to next-intl includes Légion storefront, cookie banner, Ghost Checkout OOS, Battle flash price.

## Demo Lab (`/demo`)

- **Public**: parcours + feedback sans compte (`POST /api/demo/feedback`).
- **1-clic**: `DEMO_LAB_PASSWORD` (server) + `enterDemoLabAction` — emails `*@demo.affisell.com`.
- **Vercel Preview** (`VERCEL_ENV=preview`): Demo Lab **activé automatiquement** ; il suffit d’ajouter `DEMO_LAB_PASSWORD` sur l’env **Preview** puis redeploy.
- **Production**: `DEMO_LAB_ENABLED=1` + `DEMO_LAB_PASSWORD`, ou `DEMO_LAB_ENABLED=0` pour couper.
- Seed idempotent: `npm run demo:ensure` (même `DATABASE_URL` que le déploiement).

## Tests that write to a database

- Never run them against production. They only run with `RUN_DB_TESTS=1` **and** a dedicated test database in `.env.test.local` (`DATABASE_URL_TEST`, e.g. a Neon branch — template: `.env.test.local.example`).
- `lib/testing/db-test-guard.ts` refuses any URL that shares an endpoint with `DATABASE_URL` / `DIRECT_URL` / `DATABASE_URL_STAGING` in the repo env files.
- `npm run test:db:check` (read-only preflight: file, safety, connection, migrations) then `npm run test:db` (money e2e + variants).

## Git push

- Never put real API keys in `.env.example` — use empty placeholders only (`GROQ_API_KEY=""`).
- **Video Pro paywall (founder pause)**: default **paused** — suppliers can generate unlimited Veo videos without Stripe Pro. UI shows « Mode test — générations illimitées ». To **reactivate** the 3-video limit + « Passer Pro »: set Vercel env `VIDEO_PAYWALL_PAUSED=0` + `STRIPE_PRO_PRICE_ID`, then run `npm run verify:video-paywall` before deploy.
- **Service worker (`public/sw.js`, registered in production only by `PwaShellRegister`)**: carries Web Push + the offline buyer shell. Two rules: (1) the proxy `matcher` in `proxy.ts` must exclude it (and `/manifest.webmanifest`) — otherwise next-intl answers them with the home page HTML and the SW can never register (this was the case in production until 2026-10-06); (2) every page embeds the signed-in user's session (`AuthSessionProvider session=…`), so the SW only stores **cookie-less copies** of `PWA_PUBLIC_SHELL_PATHS` (`credentials: "omit"`) and never the visitor's own navigation. Keep `public/sw.js` and `lib/pwa-shell-shared.ts` in sync — `lib/__tests__/service-worker.test.ts` runs the real file in a sandbox and fails if they drift or if a personal page gets stored. Bump `CACHE_VERSION` when changing what is stored (old `affisell-buyer-*` caches are deleted on activate).
  **Rollback** (a bad worker can only be replaced at the same URL, never "undeployed"): `npm run pwa:rollback -- offline` replaces `public/sw.js` with a worker that deletes the caches and has no fetch handler but **keeps Web Push** (try this first); `-- unregister` removes the worker entirely (push subscriptions are lost). Add `--dry-run` to preview. Then commit and `npm run push:safe` as two separate commands; browsers pick it up on their next visit. Neither variant reloads pages (the page re-registers on every visit — a reloading worker would loop). Restore with `git checkout <commit> -- public/sw.js`. Tested in Chromium + WebKit (`lib/__tests__/pwa-rollback.test.ts` + a real-browser swap).
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
