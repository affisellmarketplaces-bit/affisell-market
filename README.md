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
