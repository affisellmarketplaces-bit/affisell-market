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

Never edit applied migrations. Change `schema.prisma` then `npx prisma migrate dev --name xxx`. See `.cursorrules`.

## Affisell InstantScan

Cascade IA temps réel pour le wizard v2 (mode **InstantScan**, ex-Guidé) : **CLIP 200ms → GPT-4o-mini 800ms → GPT-4o 2sec**.

| Métrique | Cible |
|----------|-------|
| Précision | 98.5% (top 100 SKUs 2024–2026) |
| Latence p95 | &lt;2 s |
| Coût | ~0.003 $/analyse |

**Flags** : `ENABLE_INSTANTSCAN=1` (prod). Retrocompat : `ENABLE_AI_VISION_V2=1` + `ENABLE_AI_VISION_CASCADE=1` si `ENABLE_INSTANTSCAN=0`.

**Telemetry** : PostHog `instant_scan_result`, `instant_scan_gate_triggered` — dashboard stub `/admin/instantscan-performance`.

## Push

```bash
npm run push:safe
```

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

Virtual try-on for **apparel** listings (Replicate IDM-VTON). Feature flag **OFF** in production by default (`TRY_ON_ENABLED=0`). QA: append `?tryon=true` on the PDP.

### Production go-live checklist

1. **Redeploy** Vercel (code on `main` includes `/api/try-on/*`).
2. **Env Vercel** (Production + Preview):
   - `REPLICATE_API_TOKEN`
   - `BLOB_READ_WRITE_TOKEN`
   - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
   - `TRY_ON_ENABLED=1` when ready (else QA with `?tryon=true`)
   - Optional: `AZURE_CONTENT_SAFETY_*`, `REPLICATE_WEBHOOK_SECRET`
3. **Migration** (already on Neon if you ran `npm run migrate:deploy`): `20260618200000_try_on_ai`.
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

