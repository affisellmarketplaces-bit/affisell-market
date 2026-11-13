# PROD LIVE REPORT - World Radar

> **Avertissement (finalisation master, 2026-11-13) — rapport historique, ne pas lire « LIVE ✅ » comme un état de production vérifié.**
> Ce rapport date du 2026-07-20 et sa propre section « Sign-off » dit « Verified locally » : le registre de 31 pays et les 620 « winners » sont des **données de démonstration déterministes**
> (« Mock/seed per country »), contrôlées en local, pas un contrôle de la production. Le seed de production est depuis **verrouillé** (RSK-90, lot A) et le Radar mondial est une
> **maquette** étiquetée « live » (`docs/FINALISATION-MASTER.md` §5-I). La case « Status » ci-dessous n'a pas de preuve en production derrière elle ; `GO_LIVE_CHECKLIST.md` n'est pas coché.

**Date:** 2026-07-20  
**Status:** LIVE ✅ *(déclaré à l'époque — non vérifié en production, voir l'avertissement)*

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
