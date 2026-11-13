# Affisell Market

Next.js marketplace for **suppliers** (catalog, API) and **creators/affiliates** (storefronts, margins). **Buyers** shop curated listings. EU-first defaults in `lib/market-config.ts`.

## Requirements

- Node 24+
- PostgreSQL (`prisma/schema.prisma`)
- Copy `.env.example` → `.env`
- Optional local overrides: `.env.local.example` → `.env.local` (`PORT=3001`, OAuth URLs)

## Install

```bash
npm install
npm run db:local:setup   # optional local Docker DB
npm run dev              # http://localhost:3001 (or next free port)
npm run dev:url          # print current dev origin (respects PORT)
```

### Local dev port & zsh

- Default port **3001** (`scripts/next-dev-port.mjs`, Playwright). Set `PORT`, `NEXT_PUBLIC_APP_URL`, and `NEXTAUTH_URL` together (see `.env.local.example`).
- **Zsh glob:** quote URLs with query strings — `curl "http://localhost:3001/path?wizard=v2"` — or use `npm run dev:open:wizard-v2` (builds the URL in Node).

## Persona marketing pages (i18n)

| URL | Persona | Primary CTA |
|-----|---------|-------------|
| `/en`, `/fr` | Buyer | Explore catalog → `/marketplace` |
| `/en/creators`, `/fr/creators` | Creator | Create store → `/signup/affiliate?role=creator` |
| `/en/partners`, `/fr/partners` | Supplier/brand | Become partner → `/signup/supplier?role=supplier` |

Legacy paths redirect: `/` → `/en`, `/creators` → `/en/creators`.

### i18n stack

- `i18n/routing.ts` — locales `en` | `fr` | `de` | `es` | `it` | `nl` | `pl` | `zh`
- `i18n/request.ts` — messages + cookie `affisell_locale`
- `middleware.ts` — next-intl + auth (merged)
- `messages/{locale}.json` — full UI bundles (1722+ keys each)
- `scripts/i18n-translate-locale.mjs` — Groq batch translate + parity check
- `components/LanguageSwitcher.tsx` — 8-locale dropdown

### Key UI components

- `components/HeroSection.tsx` — persona hero
- `components/BentoGrid.tsx` — buyer bento (4 cards)
- `components/FeatureCard.tsx` — feature tile
- `components/AnimatedCounter.tsx` — react-countup
- `components/CommandK.tsx` — cmdk + fuzzy + product preview
- `components/TestimonialCarousel.tsx` — embla carousel
- `components/MarketingFooter.tsx`

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Prisma generate + Next dev |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run test:e2e` | Playwright |

## Dependencies added (marketing UX)

- `cmdk` — command palette
- `embla-carousel-react` — carousels
- `react-countup` — animated numbers
- `@vercel/analytics` — CTA/page analytics
- `next-intl`, `next-themes`, `framer-motion` (already used)

## OG images

`GET /api/og?title=...&subtitle=...` — dynamic 1200×630 image.

## Prisma / Neon

Never edit applied migrations. A schema change is a **hand-written, additive SQL migration** under `prisma/migrations/` plus the matching `schema.prisma` edit — **never** `prisma migrate dev`, `prisma db push`,
`npm run db:migrate` or `npm run migrate:deploy` on this database: it also holds Medusa's tables (Prisma would propose to drop them) and `prisma.config.ts` loads `.env.local` with `override: true`, so those commands
target the *default* database, i.e. production, whatever URL you pass.

Deploy a schema by hand, locally, **before** the push: `DATABASE_URL='<url>' npm run schema:migrate -- --expect-endpoint <ep-id> [--confirm-production]`, then `npm run schema:verify`.
The Vercel build never migrates: it only verifies, and stops if the schema is missing. Full procedure and failure handling: `docs/DEPLOY-SCHEMA-CHANGES.md`;
environments and isolation: `docs/ENVIRONMENTS.md`; backups and restores: `docs/BACKUP-RESTORE.md`; settings to make on external services: `docs/EXTERNAL-OPS-RUNBOOK.md`; project rules: `AGENTS.md`.

## Affisell InstantScan

Analyse d'une photo produit par un modèle de vision (API opt-in `POST /api/ai/analyze-product`, UI supplier retirée). Deux étapes :

1. **Rapprochement catalogue** — un modèle de vision mini (`gpt-4o-mini` par défaut) écrit des indices **texte** (marque, modèle, caractéristiques) ; ceux-ci sont comparés, comme du texte (vecteurs lexicaux par hachage), à une liste de modèles **écrite à la main** (`lib/ai/curated-product-catalog.ts`). **Ce n'est pas du CLIP** : aucune image n'est vectorisée, aucun modèle d'embedding n'intervient, et la liste n'est ni un classement mesuré ni un « top 100 ». Un résultat de cette étape n'a **aucune confiance affichée** (rien n'a été mesuré) et est toujours « à vérifier ».
2. **Modèle de vision complet** (`gpt-4o` par défaut ; `gpt-4o-mini` si le premier échoue — la réponse l'indique : `provenance.modelUsed`, `provenance.fallbackUsed`, étape `mini`).

**Aucune performance n'est garantie.** Précision, latence et coût sont **mesurés ou non affichés** :

| Sujet | Statut |
|-------|--------|
| Précision de reconnaissance | **Non mesurée** (aucun jeu de photos réelles étiquetées). Méthode : `docs/AI-HONESTY-AND-MEASUREMENT.md` |
| Latence (par étape, p50/p95) | Mesurée à chaque appel — `/admin/instantscan-performance` |
| Jetons et coût | Jetons réels renvoyés par le fournisseur ; coût = **estimation** (table de prix versionnée `lib/ai/model-pricing.ts`) — `/admin/instantscan-performance` |

Les anciens chiffres « CLIP 200 ms », « 98,5 % », « p95 < 2 s », « 0,003 $/analyse », « top 100 SKUs » étaient des **objectifs**, jamais des résultats ; ils ont été retirés.

> Ce sont des **objectifs de conception, non mesurés** à ce jour : aucune mesure de précision, de latence ni de coût n'existe dans le dépôt (voir `docs/FINALISATION-MASTER.md` §5-I). Ne pas les présenter comme des performances.

**Flags** : `ENABLE_INSTANTSCAN=1` (prod). Retrocompat : `ENABLE_AI_VISION_V2=1` + `ENABLE_AI_VISION_CASCADE=1` si `ENABLE_INSTANTSCAN=0`.

**Mesure** : chaque appel des clients LLM de l'application (OpenAI, Groq, Anthropic, Gemini, génération de description GPT-4o) écrit une ligne JSON `[ai-usage]` dans les logs et dans un journal borné (Redis si configuré, sinon mémoire de l'instance) — `lib/ai/usage-log.ts`. Périmètre exact et appels non couverts (modération, Replicate, Veo, scripts) : `docs/AI-HONESTY-AND-MEASUREMENT.md` ; un coût affiché est un minimum. Les événements PostHog `instant_scan_*` (`lib/telemetry.ts`) sont définis mais **jamais émis** : ne pas s'y fier.

## Push

```bash
git commit -m "…"                          # shell command 1
npm run push:safe -- <your-branch>         # shell command 2, on its own (secret scan, fetch / pull --rebase / push with timeouts)
```

Two separate commands (a `commit && push` can hang on the network). **Name the branch**: `scripts/git-push-safe.mjs` defaults to `main` when given no argument, even from another branch. Never a bare `git push origin main`:
a push to `main` deploys to production. Work on a branch → Preview → pull request (details: `PUSH_INSTRUCTIONS.md`).
If the change needs a migration, apply it **before** the push (see « Prisma / Neon » above).

## AliExpress Auto-Order Flow

When a marketplace order is **paid**, Affisell can place the matching dropship order on AliExpress Open API (DS).

```
Stripe checkout.session.completed (paid)
  → Order status=paid + shippingAddress snapshot
  → triggerAutoFulfillmentForStripeSession
       ├─ auto-buy queue (FulfillmentLog) → createAliExpressDsOrder
       │     fallback: browser checkout + Stripe Issuing card
       └─ universal auto-order batch → AliExpressSupplierAdapter.placeOrder
  → Order.supplierOrderId = AE order id, status=fulfilling
```

### Env

| Var | Role |
|-----|------|
| `ALIEXPRESS_APP_KEY` / `APP_SECRET` | Open Platform app (e.g. 534690) |
| `ALIEXPRESS_ACCESS_TOKEN` / `REFRESH_TOKEN` | Bootstrap; auto-refresh → DB (`PlatformOAuthCredential`) |
| `CRON_SECRET` | Auth for create/fulfill/refresh routes |
| `ENCRYPTION_KEY` | Encrypt tokens at rest |
| `AE_DRY_RUN=true` | Fake AE order ids (no real DS place) |
| `DISABLE_AUTO_BUY=true` | Kill switch |

### Manual / ops APIs

```bash
# 1) Place DS order directly (test product + SKU) — MUST pass CRON_SECRET
curl -sS -X POST "https://affisell-market.vercel.app/api/aliexpress/order/create" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "supplierProductId":"100500123",
    "skuId":"120000123",
    "quantity":1,
    "shippingAddress":{
      "name":"Test Buyer",
      "phone":"+33612345678",
      "address1":"10 Rue de Rivoli",
      "city":"Paris",
      "zip":"75001",
      "countryCode":"FR",
      "state":"IDF"
    }
  }'
# → { "ok":true, "aliexpressOrderId":"…", "trackingPreview":null }

# Equivalent auth options:
#   -H "x-cron-secret: $CRON_SECRET"
#   "?secret=$CRON_SECRET" on the URL
#   JSON field "secret":"$CRON_SECRET" in the body
```

```bash
# 2) Fulfill a paid Affisell order (idempotent)
curl -sS -X POST "https://affisell-market.vercel.app/api/orders/$ORDER_ID/fulfill" \
  -H "Authorization: Bearer $CRON_SECRET"
# → { "ok":true, "aliexpressOrderId":"…", "status":"fulfilling" }

# Async (BullMQ / Inngest event order.paid, retry 3×):
curl -sS -X POST "https://affisell-market.vercel.app/api/orders/$ORDER_ID/fulfill" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"async":true}'
```

Auth alternatives: `x-cron-secret`, `?secret=`, JSON `secret`, or HMAC-SHA256 of body in `x-affisell-signature` (secret = `CRON_SECRET`).

### Worker

```bash
npm run worker:auto-order   # REDIS_URL required — listens order.paid + auto-buy
```

### Mapping

`lib/aliexpress-mapping.ts` → `mapAffisellAddressToAliExpress()` builds AE `logistics_address` (`contact_person`, `full_address`, `city`, `province`, `zip`, `country`, `mobile_no`, `phone_country`). Logs only **city + zip** (never full street).

Place-order uses the official DTO (`param_place_order_request4_open_api_d_t_o` with `logistics_address` + `product_items`), signed with Open Platform HMAC-SHA256 on `api-sg.aliexpress.com/sync` (`aliexpress.ds.order.create` → fallback `aliexpress.trade.buy.placeorder`). Prefer a real AE `sku_attr` (ex. `14:200003699#Black`), not a placeholder sku id.

### Token refresh

Cron every 12h: `GET /api/aliexpress/refresh` (see `vercel.json`).

## Try-On AI

Virtual try-on for **apparel** listings (Replicate IDM-VTON). Feature flag **OFF** in production by default (`TRY_ON_ENABLED=0`). QA: append `?tryon=1` on the PDP of a **Preview or local** run — the query-string override is ignored in production (AGENTS.md, « Virtual try-on »).

### Production go-live checklist

1. **Redeploy** Vercel (code on `main` includes `/api/try-on/*`).
2. **Env Vercel** (Production + Preview):
   - `REPLICATE_API_TOKEN`
   - `BLOB_READ_WRITE_TOKEN`
   - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
   - `TRY_ON_ENABLED=1` when ready (on a Preview, QA with `?tryon=1`)
   - Optional: `AZURE_CONTENT_SAFETY_*`; `REPLICATE_WEBHOOK_SECRET` (Replicate signing secret — activates signature verification of `/api/try-on/webhook`; exact steps in `docs/EXTERNAL-OPS-RUNBOOK.md` §6)
3. **Migration** `20260618200000_try_on_ai`: apply it by hand **before** deploying, on staging then production, with `DATABASE_URL='<url>' npm run schema:migrate -- --expect-endpoint <ep-id> [--confirm-production]`
   and check with `npm run schema:verify` (never `npm run migrate:deploy`: it targets the default database). The Vercel build only verifies.
4. **Cron** — `vercel.json` runs `/api/cron/try-on-retention` daily (GDPR blob cleanup).
5. **Pilot product**:
   ```bash
   TRYON_PILOT_GARMENT_URL="https://…/cutout.png" npm run tryon:pilot
   ```
   Or supplier dashboard → product → **AI Try-On** → upload PNG → Save.
6. **Smoke test**:
   ```bash
   curl -s "https://affisell.com/api/try-on?jobId=test&tryon=true"
   # → {"error":"Job not found"} (route live, not HTML 404)
   ```

### Supplier setup

1. Product must be in an apparel category.
2. Dashboard → product → **AI Try-On**: enable + paste transparent PNG flat-lay URL (`Product.tryOnGarmentUrl`).
3. PDP shows **Try on** only when `tryOnEnabled` + garment URL are set.

### API

- OpenAPI: `app/api/try-on/openapi.json`
- `POST /api/try-on/upload` — shopper photo → Vercel Blob (WebP ≤1024px)
- `POST /api/try-on` — start async job (returns `jobId`)
- `GET /api/try-on?jobId=` — poll status
- `POST /api/try-on/webhook` — Replicate completion

### Quotas

| Visitor | Limit |
|---------|--------|
| Anonymous | 1 lifetime try (`tryon_anon_id` cookie + IP hash) |
| Logged-in | 5/min, 10/day (Upstash) |
| Affisell+ (`User.isPro`) | Unlimited |

### GDPR retention

Cron `GET /api/cron/try-on-retention` (`Bearer CRON_SECRET`): delete input blobs after **24h**, output records after **30 days**.

### Cost / latency (typical)

- Replicate IDM-VTON: ~$0.02–0.06 / generation
- End-to-end perceived: **2–8s** (async webhook; client polls)
- Smart crop + pose hints run client-side (MediaPipe) before upload

### Monitoring

Sentry spans tagged `feature: tryon`, `model: idm-vton`. Business logs: `[try-on] { jobId, productId, latencyMs }`. Analytics table: `TryOn` + `TryOnJob`.

## Medusa Try-On Extension

Native Virtual Try-On on **Medusa v2** (`medusa-backend/`) — linked Product module, admin widget, store API whitelist. Existing Affisell `/api/try-on` is **unchanged**.

```
┌─────────────┐     GET /store/products?handle=x      ┌──────────────────┐
│ Next.js     │ ───────────────────────────────────►│ Medusa Store API │
│ /produits/* │     try_on_enabled, tryon_garment_url │ + try-on module  │
└──────┬──────┘                                       └────────┬─────────┘
       │ POST /api/try-on (selfie + garment_url)               │
       └──────────────────────────────────────────────────────►│ Replicate IDM-VTON
```

### Env (Next.js + Vercel)

```bash
MEDUSA_BACKEND_URL="https://medusa.example.com"
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY="pk_…"
NEXT_PUBLIC_MEDUSA_BACKEND_URL="https://medusa.example.com"  # optional client
TRY_ON_ENABLED=1
```

### Store curl

```bash
curl -s "$MEDUSA_BACKEND_URL/store/products?handle=leggings-demo&fields=try_on_enabled,tryon_garment_url" \
  -H "x-publishable-api-key: $NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY"
```

### Admin curl

```bash
curl -X POST "$MEDUSA_BACKEND_URL/admin/products/$ID/try-on" \
  -H "Authorization: Bearer $MEDUSA_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"try_on_enabled":true,"tryon_garment_url":"https://….blob.vercel-storage.com/flat.png"}'
```

Front route: `/produits/[handle]` · Medusa docs: `medusa-backend/README.md` · E2E: `MEDUSA_E2E_ENABLED=1 npm run test:e2e -- e2e/medusa-try-on.spec.ts`

### Env

See `.env.example` — `REPLICATE_API_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `UPSTASH_REDIS_REST_*`, optional Azure Content Safety.

