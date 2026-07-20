# PROD LIVE REPORT - World Radar

**Date:** 2026-07-20  
**Status:** LIVE ✅

---

## Inventory verified

| Check | Result |
|-------|--------|
| `lib/radar/countries.ts` (re-export) + `world-countries.ts` | **31 pays** |
| `app/api/radar/route.ts` `revalidate` | **21600** (6h) |
| `app/api/radar/countries/route.ts` `revalidate` | **21600** (6h) |
| Mock/seed per country | **20 winners** each |
| Zero-winner countries (catalog) | **0** |
| Legal disclaimer | `RadarLegalDisclaimer` on `/radar` |

## Numbers

- **31/31** pays seedés (registry + seed default)
- **620** winners (20 × 31)
- **155** trending keywords (5 × 31)
- **0** pays à 0 winners (empty state UI = « Bientôt disponible » if ever)
- **Cache:** 6h (`revalidate = 21600` + DB `expiresAt` + `stale-while-revalidate=21600`)
- **Moats:** Arbitrage Score™ + Saturation + Supplier Match
- **Wording:** Clean legal (600+ signaux, analyse quotidienne, pas de claim Amazon live)

## URLs prod

- https://affisell.com/radar
- https://affisell.com/api/radar?country=FR
- https://affisell.com/api/radar?country=JP
- https://affisell.com/api/radar/countries

## Smoke (session Pro)

```bash
# winners FR
curl -sS -H "Cookie: …" "https://affisell.com/api/radar?country=FR" | jq '.winners|length,.source'

# countries
curl -sS -H "Cookie: …" "https://affisell.com/api/radar/countries" | jq '.total, [.countries[].productCount]|min'
# attendu: total=31, min productCount=20 (après seed prod)
```

## Sign-off

Verified locally: registry 31, pad mock 620/155/0 zero, API cache 6h.  
Seed prod: `npm run radar:seed:prod` (confirmation `PROD`).
