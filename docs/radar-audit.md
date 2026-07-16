# AFFISELL RADAR — AUDIT DU 2026-07-16 (post-P0)

**Auditeur :** Senior Staff  
**Scope :** `/radar`, `/api/radar`, `lib/radar`, `prisma/radar.schema.prisma`, `proxy.ts`, `vercel.json`  
**Docs :** `docs/radar-plan.md`, `docs/radar-spec.md`  
**Note :** pas de `middleware.ts` — Next.js 15+ → **`proxy.ts`** (`docs/radar-plan.md`).

## Score Global: **74/100**

(+16 vs 58) — P0 OAuth Redis, empty-state crawler, rate-limit scan, doc `proxy.ts` corrigés.  
Reste produit : Winners/Map (J6), refresh tokens, multi-marketplace live, data crawler en prod.

---

## P0 — corrigés (2026-07-16)

| ID | Issue | Fix | Preuve |
|----|-------|-----|--------|
| P0-1 | State OAuth Map multi-instance | `requireRedis()` si `RADAR_ENABLED=true` ; Redis `radar:oauth:state:*` JSON ; Map **uniquement** si Radar off + warn ; `/radar/connect` bloque « Redis not configured » | `lib/radar/gate.ts`, `tiktok-shop.ts`, `connect/page.tsx` |
| P0-2 | Dashboard vide / cron crash sans keys | Cron `200 skipped` si keys manquantes ; banner jaune + Force Scan disabled si `count=0` | `cron/global-scan/route.ts`, `app/radar/page.tsx` |
| P0-3 | Force Scan abusable | Redis `INCR radar:scan:rate:{ip}` EX 60 max 5 → 429 ; Map fallback dev | `lib/radar/scan-rate-limit.ts`, `scan` + `cron/global-scan` |
| P0-4 | Doc `middleware.ts` | Plan documente **`proxy.ts`** uniquement | `docs/radar-plan.md` |

---

## PHASE 1 — Architecture

### Routes UI

| Fichier | Auth / Gate |
|---------|-------------|
| `app/radar/page.tsx` | `auth` + `isRadarEnabled` + features ; empty banner si count=0 |
| `app/radar/connect/page.tsx` | Redis required si Radar on |
| `app/radar/winners` / `map` | **ABSENT** (stubs nav Jalon 6) |

### API

| Route | Auth | Notes |
|-------|------|-------|
| `tiktok/start` | gate + Redis + session | OAuth |
| `tiktok/callback` | gate | encrypt + state verify + user mismatch |
| `webhooks/tiktok` | gate + HMAC | idempotent `P2002` |
| `cron/global-scan` | CRON_SECRET + rate-limit | skip 200 sans keys |
| `scan` POST | gate + rate-limit + session | Force Scan UI |

---

## PHASE 2 — Sécurité

| Check | Statut |
|-------|--------|
| Tokens chiffrés at rest | ✅ |
| State OAuth Redis (prod Radar) | ✅ `requireRedis` + JSON payload + del |
| Map mémoire OAuth | ✅ seulement `RADAR_ENABLED≠true` + `console.warn` |
| Webhook HMAC rawBody | ✅ |
| Cron CRON_SECRET | ✅ |
| Rate-limit scan | ✅ 5/min/IP |
| Token refresh / decrypt read path | 🔴 P1 |

---

## PHASE 3 — Fonctionnel

| Check | Statut |
|-------|--------|
| Build `RADAR_ENABLED=false` | ✅ |
| `/intelli` → `/radar` via `proxy.ts` | ✅ |
| Empty UX sans crawler keys | ✅ |
| Cron ne crash pas sans keys | ✅ |
| Winners / Map pages | 🔴 Jalon 6 |
| `getProducts` connectors | 🔴 |
| Live data sans keys Vercel | 🟡 skip/banner (attendu) |

---

## ✅ OK

- Rebrand + aliases + gate + cron exempt — `proxy.ts` / `gate.ts`
- Schema Neon `market_intelli` — `prisma/radar.schema.prisma`
- TikTok OAuth encrypt + Redis state — `tiktok-shop.ts`
- Dashboard J5 + empty state — `app/radar/page.tsx`
- Cron 6h + skip keys — `vercel.json` + `global-scan`
- Scan rate-limit — `scan-rate-limit.ts`

---

## 💥 Reste (non-P0)

### P1
1. **Refresh tokens TikTok** — pas de job `decryptString` / renew avant `expiresAt`
2. **Amazon scrape** — fragile / ToS ; ne pas vendre comme SP-API ready
3. **Serper key in query** — `trends-watcher` (risque logs URL)

### P2 / produit
4. **Jalon 6** — `/radar/winners`, `/radar/map`, alertes
5. **Multi-marketplace live** — registry UI only ; TikTok seul
6. **Writers** `StandardProduct` / `GoogleProductInsight` — models only

---

## Jalons vs plan

| Jalon | Statut |
|-------|--------|
| 1 Rebrand / gate | ✅ |
| 2 Registry + TikTok OAuth | ✅ (+ Redis obligatoire) |
| 3 Schema V3 | ✅ |
| 4 Crawler + cron | 🟡 code OK ; data = keys Vercel |
| 5 Dashboard live | ✅ (+ empty state) |
| 6 Winners / Map | 🔴 stubs only |

---

## Recommandations prod (ordre)

1. Vercel Env : `REDIS_URL`, `TIKTOK_CRAWLER_ACCESS_TOKEN`, `SERPER_API_KEY`, `RADAR_ENABLED=true`
2. Vérifier OAuth : Connect TikTok → callback → `/radar?connected=1`
3. Cron : `curl -H "Authorization: Bearer $CRON_SECRET" …/api/radar/cron/global-scan` → `skipped` ou `scanned`
4. Ship Jalon 6 (Winners/Map) + token refresh

---

## Test rapide

```bash
# Cron sans keys → 200 skipped
curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP/api/radar/cron/global-scan"

# Connect sans Redis (Radar on) → message Redis not configured
# Force Scan >5/min → 429
```
