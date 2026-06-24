# Affisell Medusa Backend

Medusa v2 commerce backend with native **Virtual Try-On** extension (linked Product module).

## Quick start

```bash
cd medusa-backend
cp .env.template .env
npm install
npx medusa db:migrate
npm run dev
```

Admin: `http://localhost:9000/app` · Store API: `http://localhost:9000/store`

## Try-On data model

Medusa v2 extends Product via a **linked custom module** (not core Product edits):

| Field | Type | Notes |
|-------|------|-------|
| `try_on_enabled` | `boolean` default `false` | Index `IDX_product_try_on_enabled` |
| `tryon_garment_url` | `text` nullable | HTTPS Vercel Blob or Cloudinary only |

Module: `src/modules/product-try-on/`  
Link: `src/links/product-try-on.ts`

### Migrations

```bash
npx medusa db:generate productTryOnModule
npx medusa db:migrate
```

Pre-built migration: `src/modules/product-try-on/migrations/Migration20260623190000ProductAddTryon.ts`

## Admin widget

`src/admin/widgets/product-tryon-widget.tsx` — zone `product.details.side.after`

- Switch **Activer Virtual Try-On**
- Garment URL input + preview
- Saves via `POST /admin/products/:id/try-on`
- Rate limit: **10 req/min** per admin user

## Store API

GET `/store/products?handle=…&fields=try_on_enabled,tryon_garment_url`

Middleware (`src/api/store/products/middlewares.ts`) flattens linked fields:

```json
{
  "products": [{
    "id": "prod_…",
    "handle": "leggings-demo",
    "try_on_enabled": true,
    "tryon_garment_url": "https://….blob.vercel-storage.com/flatlay.png"
  }]
}
```

Cache: `Cache-Control: s-maxage=60` (+ Redis cache module when `REDIS_URL` set).

## curl examples

```bash
# Store — fetch try-on fields
curl -s "http://localhost:9000/store/products?handle=leggings-demo&fields=try_on_enabled,tryon_garment_url" \
  -H "x-publishable-api-key: $NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY"

# Admin — enable try-on
curl -X POST "http://localhost:9000/admin/products/$PRODUCT_ID/try-on" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"try_on_enabled":true,"tryon_garment_url":"https://….blob.vercel-storage.com/garment.png"}'
```

## Env

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres (Medusa) |
| `REDIS_URL` | Optional — 60s cache + events |
| `STORE_CORS` | Next.js storefront origins |
| `JWT_SECRET` / `COOKIE_SECRET` | Admin auth |

## Affisell front

Next.js route: `/produits/[handle]` → `lib/medusa/fetch-product.ts`  
Existing `/api/try-on` unchanged — garment URL must match an Affisell Prisma product for job execution.

## Prisma sync (Medusa Admin → `/api/try-on`)

Workflow `src/workflows/try-on/sync-to-prisma.ts` mirrors try-on flags into Affisell `Product`:

| Medusa | Prisma |
|--------|--------|
| `try_on_enabled` | `tryOnEnabled` |
| `tryon_garment_url` | `tryOnGarmentUrl` |
| `handle` | `medusaHandle` (unique) |

**Env:** `DATABASE_URL_PRISMA` — same Neon URL as affisell-market (optional; skip + warn if absent).

Hooks: product create/update (`additional_data`) + `POST /admin/products/:id/try-on` widget.

```bash
# Link test product (once)
# UPDATE "Product" SET "medusaHandle" = 'leggings-demo' WHERE …;

# Toggle in Admin → verify
# SELECT "tryOnEnabled" FROM "Product" WHERE "medusaHandle" = 'leggings-demo';
```

## Railway deploy

```bash
cd medusa-backend
npm run setup:auto          # local publishable key
npm run seed:stripe           # EU region + pp_stripe_stripe
npm run deploy:railway      # needs RAILWAY_TOKEN, else prints manual steps
./scripts/vercel-env.sh     # wire Vercel production env
```

Config: `railway.json` · env template: `.env.railway`

## Stripe checkout

1. Set `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` in `.env`
2. `npm run seed:stripe` — links `pp_stripe_stripe` to EU region
3. Webhook URL: `https://<medusa-host>/hooks/payment/stripe`
4. Next.js: `POST /api/checkout` with `{ "cart_id": "cart_…", "medusa": true }` → `client_secret`
5. `<CheckoutButton cartId="cart_…" />` uses `@stripe/stripe-js` + `confirmPayment`

## Prisma auto-create

On Medusa Admin product create, workflow `sync-product-to-prisma` creates Affisell `Product` when:
- `DATABASE_URL_PRISMA` is set
- `MEDUSA_PRISMA_SYNC_SUPPLIER_ID` points to a valid supplier `User.id`

Backfill: `npm run backfill:prisma`
