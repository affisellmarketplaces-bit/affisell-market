# Affisell Radar Spec V3

## Mission
Affisell Radar = veille globale multi-marketplace + Google. Remplace Market Intelli (`/intelli`). Metric cible : +10% LTV via détection winners / pricing / expansion avant les concurrents.

## Surface produit
| Route | Rôle |
|-------|------|
| `/radar` | Dashboard sources + badge Signal Actif |
| `/radar/connect` | Google + marketplaces par région |
| `/radar/winners` | Stub |
| `/radar/map` | Stub |
| `/api/radar/tiktok/*` | OAuth + webhooks TikTok Shop (live) |
| `/api/radar/[connectorId]/start` | Start générique registry |
| `/api/radar/google/start` | Stub Google OAuth |

## Compatibilité
- `/intelli` → **301** `/radar` (via `proxy.ts`, convention Next.js 16)
- `/api/intelli/*` → **301** `/api/radar/*`
- Env fallback 1 mois :
  - `RADAR_ENABLED \|\| MARKET_INTELLI_ENABLED`
  - `RADAR_DATABASE_URL \|\| MARKET_INTELLI_DATABASE_URL`
  - `RADAR_BETA_USER_IDS \|\| MARKET_INTELLI_BETA_USER_IDS`
- Feature flags JWT : `radar` + `market_intelli`
- `getMiDb()` alias de `getRadarDb()`

## Connectors (`lib/radar/connectors`)
### Types
`Region`, `Category`, `BaseConnector`, `MarketplaceConnector`, `GoogleConnector`

### Marketplaces (registry)
TikTok Shop (live), Amazon, MercadoLibre, Walmart, Shopee, Jumia, Noon, Allegro

### Google
Merchant Center, Search Console, Trends — stubs « Bientôt »

### URL parser
`detectMarketplace(url)`, `extractProductId(url)`

## Prisma (`prisma/radar.schema.prisma`)
Schéma Postgres isolé, `@@schema("market_intelli")` :
- `ShopConnection` — multi-connector `@@unique([userId, connectorId, shopId])`
- `StandardProduct` — snapshots normalisés
- `GoogleProductInsight` — signaux GMC / Search Console
- `WebhookEvent` — ingest idempotent (`externalId` unique)

Client généré : `.prisma/client-mi` (lazy via `getRadarDb()` — build safe si flag off).

## Gate
Si `RADAR_ENABLED != true` et `MARKET_INTELLI_ENABLED != true` → rewrite `/404` pour `/radar` et `/api/radar`.

## Scripts
```bash
npm run radar:db:push    # node scripts/radar-db.mjs push
npm run radar:db:studio
npm run mi:db:push       # alias
```

## Build constraints
1. `RADAR_ENABLED=false` + pas de `RADAR_DATABASE_URL` → `next build` OK
2. Ne pas toucher `app/dashboard`, `app/pricing`, `prisma/schema.prisma`
3. Tout Radar reste sous `/radar`, `/api/radar`, `lib/radar`, `prisma/radar.schema.prisma`
