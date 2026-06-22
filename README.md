# Affisell Market

Next.js marketplace for **suppliers** (catalog, API) and **creators/affiliates** (storefronts, margins). **Buyers** shop curated listings. EU-first defaults in `lib/market-config.ts`.

## Requirements

- Node 20+
- PostgreSQL (`prisma/schema.prisma`)
- Copy `.env.example` → `.env`

## Install

```bash
npm install
npm run db:local:setup   # optional local Docker DB
npm run dev              # http://localhost:3001 (or next free port)
```

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

## Push

```bash
npm run push:safe
```

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

### Env

See `.env.example` — `REPLICATE_API_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `UPSTASH_REDIS_REST_*`, optional Azure Content Safety.

