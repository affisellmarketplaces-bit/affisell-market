# Affisell Market

Next.js marketplace for **suppliers** (catalog, base price, commission) and **affiliates** (storefront, selling price, marketplace listings). EU-first storefront defaults (locale / currency) live in `lib/market-config.ts`.

## Requirements

- Node 20+
- PostgreSQL (see `prisma/schema.prisma`)
- Environment variables: copy `.env.example` → `.env` and fill values for your environment.

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Prisma generate + Next dev (port **3001**) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests (`**/*.test.ts`) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:e2e` | Playwright (`e2e/*.spec.ts`) |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run db:push` / `db:migrate` | Prisma against `DATABASE_URL` |

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs **lint** and **Vitest** on push/PR to `main`. E2E is not in CI by default (needs a running app + `DATABASE_URL`); run `npm run test:e2e` locally or against a preview URL.

## Testing

Vitest uses an empty `vitest-env/` as `envDir` so local `.env` is not read during tests. Tests live next to pure logic (e.g. `lib/__tests__/*`).

### End-to-end (Playwright)

- **Install browsers** (once per machine / CI image): `npx playwright install chromium`
- **Run**: `npm run test:e2e` — starts `npm run dev` on **3001** unless the server is already up (`reuseExistingServer` outside CI), then runs all specs under `e2e/`.
- **Point at another URL** (e.g. preview deploy): `PLAYWRIGHT_BASE_URL=https://… npm run test:e2e` and set `PLAYWRIGHT_SKIP_WEBSERVER=1` so Playwright does not spawn a local dev server.
- **Smoke** (`e2e/smoke.spec.ts`): home hero, `/marketplace`, header **Cart** → `/cart`.
- **Public flows** (`e2e/public-flows.spec.ts`): `/api/categories`, `GET /api/cart`, `/auth/signin`, `/login` → sign-in, `/discover`, `/wishlist` → sign-in.

### After a Vercel deploy

1. **Build logs**: confirm Sentry **Successfully uploaded source maps to Sentry** (needs `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` on Vercel).
2. **Sentry**: trigger a test error on the production URL and confirm **de-minified** stack frames.
3. **Playwright on preview** (optional): `PLAYWRIGHT_BASE_URL=https://your-preview.vercel.app PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e`

## i18n

- Server: `i18n.ts` loads `messages/en.json` or `messages/fr.json` when `NEXT_PUBLIC_MESSAGES_LOCALE=fr`.
- Client: `app/providers.tsx` mirrors the same env for `next-intl` client components.

Money formatting stays tied to `NEXT_PUBLIC_MARKET_REGION` / storefront currency, not the message locale.

## Rate limiting

In-memory fixed-window limits (see `lib/api-rate-limit.ts`) protect expensive unauthenticated or high-cost routes (e.g. visual search, categorization, agent chat). For multi-instance production, replace with Redis (e.g. Upstash).

## Error UI & monitoring

- `app/global-error.tsx` — root layout failures (full `html`/`body` + Sentry).
- `app/error.tsx` — segment errors under the root layout (Sentry).
- `app/dashboard/error.tsx` — dashboard subtree recovery (Sentry).

**Sentry** (optional): set `NEXT_PUBLIC_SENTRY_DSN` and/or `SENTRY_DSN` (see `.env.example`). If unset, the SDK stays disabled.

**Sentry source maps** (local + Vercel): set **`SENTRY_AUTH_TOKEN`**, **`SENTRY_ORG`**, and **`SENTRY_PROJECT`** (see `.env.example`). `next.config.ts` uses `withSentryConfig` with `debug: true` / `silent: false` so the bundler logs upload progress; on success you should see **`Successfully uploaded source maps to Sentry`** in the build log. Client init lives in **`sentry.client.config.ts`** (loaded from **`instrumentation-client.ts`**). A bad token no longer fails the build (`errorHandler`), but uploads will not succeed until the token is fixed — see [Sentry Next.js source maps](https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/).

Use your host’s **log drain** or similar for structured logs alongside Sentry.

## API highlights

- **Affiliate listing read**: `GET /api/affiliate/products/[id]` (owner or `ADMIN`).
- **Supplier product read**: `GET /api/supplier/products/[id]` (owner supplier).
- **Dashboard product bridge**: `/dashboard/products/[id]` resolves affiliate listing vs supplier product by role.

## Security notes

- Never commit real `.env` or production database URLs.
- `GET` on affiliate products for `ADMIN` skips `affiliateId` — restrict admin accounts in production.

## Blind Dropship

Optional **parallel** checkout path: `POST /api/checkout` with `checkoutMode: "blind_dropship"` (Stripe **PaymentIntent** + `BlindDropshipOrder` rows). The standard marketplace **Checkout Session** flow is unchanged.

### Stripe Dashboard (webhooks)

Point your Stripe webhook to `/api/webhooks/stripe` and enable at least:

- `checkout.session.completed` — legacy marketplace cart checkout  
- **`payment_intent.succeeded`** — blind dropship PaymentIntents (`metadata.flow = blind_dropship`)

### Supplier tracking webhook

- **URL**: `POST /api/webhooks/supplier/tracking?sid={BlindDropshipSupplier.id}` (value returned from `PUT /api/supplier/blind-dropship-profile`).
- **Signature**: header `X-Signature` = **lowercase hex** `SHA256(raw_body_utf8, webhookSecret)` where `webhookSecret` is stored in the supplier profile `config.webhookSecret`.  
  The handler verifies the signature **before** parsing JSON; invalid signatures return **401** and log `Tentative webhook forgé`.
- **Body (JSON, strict keys)**:

```json
{ "supplier_order_id": "…", "tracking_number": "…", "tracking_carrier": "…" }
```

(`tracking_carrier` optional.)

### Example curl (partner → Affisell)

```bash
BODY='{"supplier_order_id":"PO-123","tracking_number":"1Z999","tracking_carrier":"UPS"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')
curl -sS -X POST "https://YOUR_DOMAIN/api/webhooks/supplier/tracking?sid=SUPPLIER_CONFIG_ID" \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIG" \
  -d "$BODY"
```

### Front checkout

- Page: `/checkout/blind` — uses guest cart + server cart (same line ids as `/cart`), checks eligibility via `POST /api/checkout/blind-eligibility`, then Stripe **Payment Element** with `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- After payment, Stripe redirects to `/order-success?blindOrderId=…`.

### Fulfillment guard

Unless `BLIND_DROPSHIP_ENABLE_STRIPE_TRANSFERS=true` **and** each supplier group has a successful Stripe **Transfer** to `stripeConnectAccountId`, the worker **does not** call the supplier `createOrder` API (order moves to `awaiting_manual_payment` and Slack is notified).

## Docs

Next.js in this repo may differ from LTS docs; see `AGENTS.md` and `node_modules/next/dist/docs/` when upgrading.
