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
| `npm run test:e2e` | Playwright smoke (`e2e/*.spec.ts`) |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run db:push` / `db:migrate` | Prisma against `DATABASE_URL` |

## Testing

Vitest uses an empty `vitest-env/` as `envDir` so local `.env` is not read during tests. Tests live next to pure logic (e.g. `lib/__tests__/*`).

### End-to-end (Playwright)

- **Install browsers** (once per machine / CI image): `npx playwright install chromium`
- **Run**: `npm run test:e2e` — starts `npm run dev` on **3001** unless the server is already up (`reuseExistingServer` outside CI), then runs `e2e/smoke.spec.ts`.
- **Point at another URL** (e.g. preview deploy): `PLAYWRIGHT_BASE_URL=https://… npm run test:e2e` and set `PLAYWRIGHT_SKIP_WEBSERVER=1` so Playwright does not spawn a local dev server.
- Smoke covers: home hero, navigation to `/marketplace`, header **Cart** link → `/cart`.

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

**Sentry** (optional): set `NEXT_PUBLIC_SENTRY_DSN` and/or `SENTRY_DSN` (see `.env.example`). If unset, the SDK stays disabled. For source map upload in CI, use Sentry’s org/project/auth token env vars.

Use your host’s **log drain** or similar for structured logs alongside Sentry.

## API highlights

- **Affiliate listing read**: `GET /api/affiliate/products/[id]` (owner or `ADMIN`).
- **Supplier product read**: `GET /api/supplier/products/[id]` (owner supplier).
- **Dashboard product bridge**: `/dashboard/products/[id]` resolves affiliate listing vs supplier product by role.

## Security notes

- Never commit real `.env` or production database URLs.
- `GET` on affiliate products for `ADMIN` skips `affiliateId` — restrict admin accounts in production.

## Docs

Next.js in this repo may differ from LTS docs; see `AGENTS.md` and `node_modules/next/dist/docs/` when upgrading.
