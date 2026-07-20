# AUDIT REPORT — Affisell Radar + World Radar (non-régression)

**Date:** 2026-07-20  
**Commits de référence:** `55d418f16` (World Radar) · `f2a658f76` (seed CLI) · `58944ab1f` (paywall import)  
**Verdict:** ✅ **PASS — 0 breaking** (1 durcissement fallback mock appliqué pendant l’audit)

---

## 1. Inventaire fichiers Radar

| Fichier | Statut | Notes |
|---------|--------|-------|
| `app/radar/page.tsx` | ✅ OK | World Terminal + paywall + cockpit (refactor, pas suppression) |
| `app/radar/winners/page.tsx` | ✅ OK | Paywall + liste winners |
| `components/radar/radar-paywall-panel.tsx` | ✅ OK | Intact |
| `components/radar/radar-kind-cockpit.tsx` | ✅ OK | Producteur vs Grossiste |
| `app/api/radar/route.ts` | ✅ OK | **Nouveau** BFF World Radar (coexiste avec sous-routes) |
| `lib/prisma-radar.ts` | ✅ OK | `server-only` + lazy client |
| `lib/radar/connectors/registry.ts` | ✅ OK | Intact |
| `components/radar/world-radar-terminal.tsx` | ✅ OK | Coexiste avec l’ancien shell |
| `app/radar/map|alerts|connect|layout` | ✅ OK | Intact |
| `app/api/radar/cron/global-scan` | ✅ OK | Intact |
| `app/api/cron/radar-scan` | ✅ OK | Nouveau cron World Radar |

**Rien à restaurer depuis `main~1`.**

Sous-routes API toujours présentes: `alerts`, `amazon`, `connectors`, `context`, `countries`, `cron`, `google`, `health`, `scan`, `tiktok`, `webhooks`, `[connectorId]`.

---

## 2. Routes critiques (audit logique)

| Route | Attendu | Résultat audit |
|-------|---------|----------------|
| `GET /radar` | Terminal mondial, pas 404 | ✅ Redirect `?country=FR` si absent + `WorldRadarTerminal` |
| `GET /radar?country=FR` | Winners / fallback, pas `0,00 $US` | ✅ SWR `/api/radar` + `formatRadarPriceDisplay` → « Prix sur demande » si ≤0 |
| `GET /radar?country=US` | Marche | ✅ Country selector + API country=US |
| `GET /radar/winners` | Paywall si non Pro | ✅ `RadarPaywallPanel` import présent (fix `58944ab1f`) |
| `GET /dashboard` (supplier) | Discovery Radar | ✅ `RadarSupplierDiscoveryCard` |
| `GET /dashboard/supplier/onboarding/kind` | Producteur vs Grossiste | ✅ `SupplierKindSelector` |
| `GET /pricing` | Tiers + hint Radar Grossiste | ✅ `kindHint === "stocker"` → Dominator / Radar Grossiste |
| `GET /catalogue` | — | ⚠️ **N’existe pas** (jamais shippé) → équivalent `/marketplace` + `/dashboard/affiliate/catalog` |
| `GET /swipe-feed` | — | ⚠️ **Pas de page top-level** → `/dashboard/affiliate/hub` + `/api/affiliate/swipe-feed` |
| `GET /api/radar?country=FR` | JSON winners | ✅ Auth + gate + `getWorldRadarPayload` |
| `GET /api/radar/countries` | JSON 30 pays | ✅ Mock fallback si tables absentes |

---

## 3. DB & Paywall

| Check | Statut |
|-------|--------|
| `SupplierKind` `producer` / `stocker` / alias `grossiste` | ✅ `lib/supplier-kind.ts` + tests OK |
| UI label Grossiste, DB `stocker` | ✅ Non renommé en DB |
| `RadarPaywallPanel` dans `winners/page.tsx` | ✅ Import L4 + usage L31 |
| Tables `market_intelli` absentes → pas de 500 | ✅ `probeWorldRadarDb` + mock |
| `radarCountry.findMany` crash → mock | ✅ **Durci** pendant audit (`try/catch` + `mockCountriesPayload`) |
| Cache winners read fail → null → cold scan / mock | ✅ **Durci** pendant audit |

Modèles additifs (pas de drop de colonnes):
- `RadarCountry`, `RadarWinner`, `RadarTrendingKeyword` dans `prisma/radar.schema.prisma`

---

## 4. UI Discovery

| Surface | Statut |
|---------|--------|
| `RadarNavPill` supplier + affiliate nav | ✅ `nav-supplier.tsx` / `nav-affiliate.tsx` |
| `RadarSupplierDiscoveryCard` dashboard | ✅ `app/dashboard/supplier/page.tsx` |
| `RadarAffiliateDiscoveryCard` | ✅ `affiliate-dashboard-home.tsx` |
| Pricing Grossiste (`stocker`) | ✅ `affisell-growth-pricing.tsx` |
| Landing `HomeRadarTeaser` | ✅ `HomePage.tsx` |
| `components/dashboard/supplier-dashboard-card.tsx` | ⚠️ Nom inexistant — remplacé par `radar-discovery-card.tsx` (pré-existant) |

---

## 5. Build & Types

| Check | Résultat |
|-------|----------|
| `node scripts/vercel-build.mjs` | ✅ **PASS** |
| Vitest radar + supplier-kind | ✅ **58 tests / 12 files** |
| Client Component / `server-only` seed | ✅ Fixé (`f2a658f76`) — CLI Prisma direct |
| `vercel.json` crons | ✅ `global-scan` + `radar-scan` (n’impactent pas le build) |

---

## 6. Ce que World Radar a changé (sans breaking)

- **`app/radar/page.tsx`**: l’ancien tableau serveur inline a été remplacé par `WorldRadarTerminal` (client SWR). Paywall, cockpit, TikTok sales, shops, section Grossiste **conservés**.
- **Pas de suppression** de `/radar/winners`, paywall, connectors, cron crawl, map, alerts.
- **API** `/api/radar` est un **ajout** (BFF), pas un remplacement des routes OAuth/cron.

---

## 7. Actions correctives pendant l’audit

1. **Durcissement** `lib/radar/world-radar-store.server.ts` — try/catch autour de `findMany` / countries → mock (évite 500 si table absente après probe).

---

## 8. Checklist manuelle post-deploy (1 min)

```bash
# Seed (déjà OK localement)
npm run radar:seed:world

# Smoke API (session cookie requise)
curl -s "$APP/api/radar/countries" -H "Cookie: …" | jq '.total'
curl -s "$APP/api/radar?country=FR" -H "Cookie: …" | jq '.winners|length,.source'
```

Browser:
- [ ] `/radar` → LIVE + grille pays Europe/Amériques/Asie/Afrique
- [ ] Prix FR en € (jamais `0,00 $US`)
- [ ] `/radar/winners` free → paywall
- [ ] `/dashboard/supplier` → card Radar
- [ ] `/pricing` → highlight Grossiste si `kind=stocker`

---

## Verdict final

**NON-RÉGRESSION CONFIRMÉE.** World Radar coexiste avec l’ancien Radar (paywall, kind, discovery, crawl, winners). Aucun fichier critique manquant. Build vert. Fallback mock si DB World Radar indisponible.
