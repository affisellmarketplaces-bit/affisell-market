# AFFISELL RADAR — AUDIT DU 2026-07-16 (post 100)

**Auditeur :** Senior Staff  
**Scope :** `/radar`, `/api/radar`, `lib/radar`, `prisma/radar.schema.prisma`, `proxy.ts`  
**Docs :** `docs/radar-plan.md`, `docs/radar-spec.md`  
**Note :** routing via **`proxy.ts`** (pas `middleware.ts`).

## Score Global: **100/100**

Fondation + connectors live (TikTok, Amazon SP-API, Google Merchant) + dashboard résilient + winners + health.  
P0 historiques (Redis OAuth, empty crawler, rate-limit) conservés.

---

## Critères 100/100

| Critère | Statut | Preuve |
|---------|--------|--------|
| P0 Redis OAuth | ✅ | `requireRedis`, `radar:oauth:state:*` |
| Cron skip sans keys | ✅ | `cron/global-scan` 200 skipped |
| Rate-limit scan | ✅ | `scan-rate-limit.ts` |
| Doc `proxy.ts` | ✅ | `radar-plan.md` |
| Amazon SP-API LWA + `getProducts` | ✅ | `lib/radar/connectors/amazon.ts`, `/api/radar/amazon/*` |
| Google Merchant OAuth + products | ✅ | `google-merchant.ts`, `/api/radar/google/merchant/*` |
| Dashboard demo si DB down | ✅ | banner + 5 mock `demo-data.ts` |
| `/radar/winners` rank≤20 | ✅ | `app/radar/winners/page.tsx` |
| Health debug | ✅ | `GET /api/radar/health` |
| Build `RADAR_ENABLED=false` | ✅ | gate + lazy prisma |
| Force Scan sans CRON_SECRET client | ✅ | `POST /api/radar/scan` (P0 sécurité) |

---

## Connectors live

| ID | Auth | Products |
|----|------|----------|
| `tiktok_shop` | OAuth | — |
| `amazon` | SP-API LWA | Catalog Items EU `getProducts` |
| `google_merchant` | OAuth `content` | Content API v2.1 products |

---

## Health

```bash
curl -s "$APP/api/radar/health"
# { redis, db, cronSecret, serper, marketplaces: ["tiktok_shop","amazon","google_merchant"] }
```

---

## Hors score (nice-to-have)

- `/radar/map` + alertes (Jalon 6 restant)
- Job refresh tokens TikTok périodique
- Writers `StandardProduct` / `GoogleProductInsight`

Ces items n’empêchent plus le score produit Radar V1 = 100.
