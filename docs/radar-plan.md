# Affisell Radar — Plan jalons

> Spec détaillée : `docs/radar-spec.md`

| Jalon | Statut | Contenu |
|-------|--------|---------|
| 1 | ✅ | Rebrand `/intelli` → `/radar`, env fallback, gate |
| 2 | ✅ | Connectors registry + TikTok OAuth |
| 3 | ✅ | Schema Prisma V3 (`ShopConnection`, snapshots) |
| 4 | ✅ | Crawler global + cron 6h + `RadarGlobalSnapshot` |
| 5 | ✅ | Dashboard live + demo fallback DB offline + `/radar/winners` |
| 6 | ⬜ | Map page |
| 10 | ✅ | Alert Engine WINNER DETECTED + Slack + cron 4h |

## Routing (Next.js 15+)

- **Pas de `middleware.ts`** — ce repo utilise **`proxy.ts`** (convention Next.js actuelle).
- Gate Radar + 301 `/intelli` → `/radar` : `proxy.ts` appelle `radarDisabledResponse` (`lib/radar/gate.ts`).
- Cron `/api/radar/cron/*` : exempt du rewrite 404 si flag off (auth `CRON_SECRET`).

## Jalon 10 — Alert Engine
- Models : `RadarAlert`, `AlertSubscription` (`prisma/radar.schema.prisma`) — `npm run radar:db:push`
- Rules : WINNER_NEW / RISING / PRICE_WAR / SATURATION_RISK / NEW_LISTING
- Cron : `GET /api/radar/cron/alerts` every 4h (`vercel.json`)
- UI : `/radar/alerts`, `/radar/alerts/settings` (Slack webhook chiffré)
- Health : `alertsTable` dans `GET /api/radar/health`

## Jalon 5 — Dashboard `/radar`
- Queries parallèles : shops, `count`, top winners `rank <= 20`
- **DB offline** → banner « Radar DB offline, mode demo » + 5 produits mock
- Trends : `getTrendingKeywords(['led strip','shapewear','phone case'])`
- Filtres marketplace / country / search (URL searchParams)
- **Forcer Scan** → `POST /api/radar/scan` (session Radar) — *jamais* `CRON_SECRET` côté client
- Cron inchangé : `GET /api/radar/cron/global-scan` + Bearer `CRON_SECRET`
- Empty state : banner si `RadarGlobalSnapshot` count = 0 (clés crawler manquantes)
- **Winners** : `/radar/winners` liste `rank <= 20`
- **Health** : `GET /api/radar/health` → `{ redis, db, cronSecret, serper, marketplaces }`
