# IMPORT AUDIT — Affisell

**Date:** 2026-07-21  
**Scope:** Audit technique + frictions utilisateur (lecture seule, aucune modification code)  
**Objectif V2:** Préparer un système d’import « le plus puissant du monde »

---

## Executive summary

Affisell n’a **pas** un module `import` monolithique. L’import est **fragmenté en 2 univers** :

| Univers | Cible DB | Qui | Source |
|---------|----------|-----|--------|
| **Supplier catalog ingest** | `Product` (+ `ProductVariant`) | Fournisseur / ADMIN | URL scrape, 1688, AliExpress API, CSV/Excel, Shopify pull, extension Chrome, webhooks |
| **Affiliate listing** | `AffiliateProduct` | Affilié | Catalogue Affisell existant uniquement (pas de scrape externe) |

**Radar World** = intelligence marché (DB séparée `market_intelli`). Le bouton **« Sourcer → »** ne passe **aucune donnée produit** au wizard — c’est un lien vers `/dashboard/supplier/products/new`.

**Pas de table `ImportJob` / `ProductImport`** — imports synchrones via API, batch max **30** produits (`SUPPLIER_IMPORT_MAX_BATCH`).

**Pas d’export Shopify/WooCommerce** pour pousser un catalogue *vers* ces plateformes. Shopify = **pull inbound** uniquement. AutoDS / Woo = **fulfillment commandes**, pas import catalogue.

---

## Flow actuel

### Schéma global ASCII

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AFFISELL IMPORT LANDSCAPE                            │
└─────────────────────────────────────────────────────────────────────────────┘

[RADAR /radar] ──"Sourcer→" (grossiste)──► [/dashboard/supplier/products/new]
      │                                              │
      │ (aucun productId / winner payload)           ├── Hub: manuel / URL / bulk / AE
      ▼                                              ├── Wizard v2 + URL panel
[Radar DB market_intelli]                            └── POST preview → POST commit
   StandardProduct snapshots                              │
   (PAS Product Affisell)                                 ▼
                                                    [Product] supplier catalog
                                                           │
[Affiliate Catalogue / Swipe] ◄── discover existing ───────┘
      │
      ├── ListingBuilderModal (édition prix, images, SEO)
      └── POST /api/affiliate/products/add
              │
              ▼
      [AffiliateProduct] boutique Affisell /shops/{slug}
              │
              ▼
      [Marketplace listing] — PAS Shopify/Woo auto-push


Détail SUPPLIER URL:
[Paste URL] → POST /api/supplier/import-url (preview)
           → POST /api/import-china (option agent Chine + route log)
           → POST /api/supplier/ai-import (pipeline IA optionnel)
           → POST /api/supplier/products/import (commit, max 30)
           → [Product draft/live] + optional import-reviews
```

### A. Radar → « Sourcer »

| Étape | Détail |
|-------|--------|
| 1 | User sur `/radar`, terminal World Radar, filtre pays |
| 2 | Mode **grossiste** (`isGrossiste`) : lien **« Sourcer → »** |
| 3 | `href="/dashboard/supplier/products/new"` — **sans query params** |
| 4 | Mode producteur : lien « Voir concurrence → » vers `/radar/winners?country=` |
| 5 | Supplier match badge FR → même destination ou onboarding si 0 fournisseur |

**Constat senior:** Le winner Radar (titre, image, score, pays) **n’est pas injecté** dans l’import. L’utilisateur repart de zéro.

### B. Supplier — import URL (preview → commit)

| Étape | API / fichier |
|-------|----------------|
| 1 | UI: `supplier-url-import-panel.tsx`, `supplier-product-import.tsx`, wizard v2 |
| 2 | **Preview:** `POST /api/supplier/import-url` → `lib/supplier-import-url-handler.ts` |
| 3 | Routing plateforme: 1688 OneBound, Shopify scrape, direct fetch, ScrapingBee fallback |
| 4 | Retour JSON `SupplierScrapedProduct` — **pas d’écriture DB** |
| 5 | **Commit:** `POST /api/supplier/products/import` → `executeSupplierProductsImport()` |
| 6 | Option reviews: `POST /api/supplier/products/:id/import-reviews` |

**Champs importés (supplier):** titre, description (+ AI rewrite option), images[], vidéos (mirror R2), prix/suggested_price, commission, variants (couleur/taille/SKU/stock), brand, category, shipping (pays, délais, coût), `sourceUrl`, `importSource`, `supplierSku`, tags/specs en description.

**Temps:** synchrone, dépend du scrape (souvent **3–15 s** URL simple; ScrapingBee/1688 peut monter à **20–40 s**). Pas de job async ni ETA UI standardisé.

### C. Supplier — China / 1688 / AliExpress

| Chemin | Route | Persist |
|--------|-------|---------|
| China wrapper | `POST /api/import-china` | Preview + `ChinaBuyRouteLog` si agent |
| AliExpress API | `POST /api/supplier/aliexpress/import` | Crée `Product` draft direct |
| 1688 | Via URL handler OneBound | Preview puis commit |

### D. Supplier — bulk CSV / Excel

| Chemin | Max | Persist |
|--------|-----|---------|
| CSV onboarding | 40 lignes (`SUPPLIER_CSV_MAX_ROWS`) | `insertBulkParsedProduct` |
| Excel bulk | parse + commit | `insertBulkParsedProduct` |

Pages: `/dashboard/supplier/import`, `/dashboard/supplier/bulk-import`

### E. Supplier — Shopify sync (inbound)

| Étape | Détail |
|-------|--------|
| 1 | `SupplierIntegration` platform=shopify |
| 2 | Manual: `POST /api/supplier/integrations/:id/shopify-sync` |
| 3 | Cron: `GET /api/cron/sync-shopify` |
| 4 | `shopify-catalog-sync.ts` → batches 30 → `executeSupplierProductsImport({ upsert: true })` |

**Direction:** Shopify → Affisell (pas l’inverse).

### F. Chrome extension

| Étape | API |
|-------|-----|
| Token | `/api/supplier/extension/token` |
| Scrape CORS | `/api/supplier/extension/import-url` |
| Save draft | `/api/supplier/extension/products` → import exec |

App: `apps/affisell-supplier-extension/`

### G. Affiliate — Catalogue

| Étape | Détail |
|-------|--------|
| 1 | `/dashboard/affiliate/catalog` → `AffiliateCatalogExperience` |
| 2 | `GET /api/affiliate/discover-catalog` |
| 3 | Clic produit → `ListingBuilderModal` |
| 4 | `GET /api/affiliate/catalog-product/:id` |
| 5 | Édition prix, images, SEO, variantes, draft/publish |
| 6 | `POST /api/affiliate/products/add` → upsert `AffiliateProduct` |

**Ne crée pas** de `Product` fournisseur — réutilise le catalogue existant.

### H. Affiliate — Swipe Feed

| Étape | Détail |
|-------|--------|
| 1 | `AffiliateSwipeFeed` → `GET /api/affiliate/swipe-feed` |
| 2 | Swipe droite → `SwipeListingStudio` |
| 3 | Charge catalog product + bootstrap |
| 4 | `ListingBuilderModal` → `POST /api/affiliate/products/add` |
| 5 | `POST /api/affiliate/swipes` (like/skip) |

### I. Ce qui n’existe PAS

- `app/api/import/*` racine (sauf `import-china`, `import-1688` legacy)
- `lib/import/*` package unique
- `components/import/*`, `hooks/useImport`
- `ImportJob` / `ProductImport` Prisma
- Bulk import depuis Radar winners
- Export auto vers Shopify / WooCommerce / TikTok Shop
- Traduction auto à l’import (sauf enrichissement Groq optionnel supplier)
- Optimisation prix auto affiliate (suggestion markup swipe seulement)

---

## Base de données (Prisma)

**Fichier:** `prisma/schema.prisma` (DB principale Affisell)

### Modèles clés

| Modèle | Rôle import |
|--------|-------------|
| `Product` | Catalogue fournisseur — `importSource`, `sourceUrl`, `aliexpressProductId`, `supplierSku`, images, variants JSON, shipping |
| `ProductVariant` | SKUs détaillés si `hasVariants` |
| `AffiliateProduct` | Listing affilié (prix vente, customImages, isListed) — **pas** import externe |
| `SupplierIntegration` | Shopify / webhook credentials, lastSync |
| `SupplierExtensionToken` | Auth extension Chrome |
| `ChinaBuyRouteLog` | Audit routage agent Chine (idempotent) |
| `AffiliateSwipe` | Historique swipe (unique affiliate+product) |
| `Review` | Reviews importées post-scrape |

**Radar (séparé):** `prisma/radar.schema.prisma` → client `.prisma/client-mi` — `StandardProduct`, `RadarWinner`, etc. **Non lié** à `Product` marketplace.

---

## Fichiers liés à l’import (inventaire)

### API routes

| Fichier | Rôle |
|---------|------|
| `app/api/supplier/import-url/route.ts` | Preview scrape URL (supplier/admin) |
| `app/api/import-china/route.ts` | Import Chine + agent buying |
| `app/api/import-1688/route.js` | Legacy 1688 |
| `app/api/supplier/products/import/route.ts` | Commit batch → Product |
| `app/api/supplier/import-csv/route.ts` | CSV parse/preview/publish |
| `app/api/supplier/bulk-import/parse/route.ts` | Excel parse |
| `app/api/supplier/bulk-import/commit/route.ts` | Excel commit |
| `app/api/supplier/bulk-import/template/route.ts` | Template Excel |
| `app/api/supplier/aliexpress/import/route.ts` | AE Open API → draft Product |
| `app/api/supplier/ai-import/route.ts` | Pipeline IA detect/fetch/enrich |
| `app/api/supplier/extension/import-url/route.ts` | Extension scrape CORS |
| `app/api/supplier/extension/products/route.ts` | Extension save draft |
| `app/api/supplier/extension/token/route.ts` | Token extension |
| `app/api/supplier/integrations/[id]/shopify-sync/route.ts` | Sync Shopify manuel |
| `app/api/cron/sync-shopify/route.ts` | Cron sync Shopify |
| `app/api/integrations/inbound/[integrationId]/route.ts` | Webhook produits entrants |
| `app/api/supplier/products/[id]/import-reviews/route.ts` | Import avis |
| `app/api/supplier/china-buy/route.ts` | Checkout agent Chine |
| `app/api/affiliate/products/add/route.ts` | Listing affilié (catalogue) |
| `app/api/affiliate/add/route.ts` | Legacy add minimal |
| `app/api/affiliate/discover-catalog/route.ts` | Browse catalogue |
| `app/api/affiliate/catalog-product/[productId]/route.ts` | Détail pour listing builder |
| `app/api/affiliate/swipe-feed/route.ts` | Feed swipe affilié |
| `app/api/affiliate/swipes/route.ts` | Like/skip |
| `app/api/admin/products/[id]/supplier-link/import-catalog/route.ts` | Admin import catalogue AE |

### Lib core

| Fichier | Rôle |
|---------|------|
| `lib/supplier-import-url-handler.ts` | Orchestrateur scrape URL |
| `lib/import-url-scrape.ts` | Détection plateforme + ScrapingBee |
| `lib/supplier-products-import-exec.ts` | Persistance Product (create/upsert) |
| `lib/map-extension-import-product.ts` | Normalise payload extension |
| `lib/product-import-agent.ts` | Agent IA import |
| `lib/product-import-ai-enrich.ts` | Enrichissement Groq |
| `lib/import-marketplace.ts` | Détection marketplace URL |
| `lib/url-import-apply.ts` | Scrape → patch wizard form |
| `lib/shopify-catalog-sync.ts` | Pull Shopify → Affisell |
| `lib/shopify-sync-map.ts` | Map Shopify JSON → import row |
| `lib/supplier-csv-import.ts` | Parse CSV |
| `lib/supplier-bulk-import-commit.ts` | `insertBulkParsedProduct` |
| `lib/supplier-bulk-excel.ts` | Parse Excel |
| `lib/aliexpress-open-api.ts` | Client AE API |
| `lib/aliexpress-product-map.ts` | Map AE → Product |
| `lib/onebound.ts` | API 1688 |
| `lib/import-video-r2.ts` | Vidéos → R2 |
| `lib/affiliate-swipe-feed.server.ts` | Query swipe feed |
| `lib/affiliate-catalog-query.ts` | Filtres catalogue |

### UI

| Fichier | Rôle |
|---------|------|
| `components/supplier-product-import.tsx` | Hub import multi-onglets |
| `components/supplier/supplier-url-import-panel.tsx` | Panel URL wizard |
| `components/supplier/supplier-bulk-excel-import.tsx` | UI Excel |
| `components/supplier/supplier-onboarding-csv-wizard.tsx` | CSV onboarding |
| `components/supplier/supplier-product-add-hub.tsx` | Hub nouveau produit |
| `components/supplier/wizard-v2/supplier-product-wizard-v2.tsx` | Wizard publish |
| `components/affiliate/affiliate-catalog-experience.tsx` | Catalogue affilié |
| `components/affiliate/listing-builder-modal.tsx` | Édition avant publish |
| `components/affiliate/swipe-feed/affiliate-swipe-feed.tsx` | Swipe deck |
| `components/affiliate/swipe-feed/swipe-listing-studio.tsx` | Studio post-swipe |
| `components/radar/world-radar-terminal.tsx` | Lien Sourcer Radar |
| `app/dashboard/supplier/import/page.tsx` | Page import dédiée |
| `app/dashboard/supplier/bulk-import/page.tsx` | Page bulk Excel |

### Hors scope import catalogue

| Fichier | Rôle réel |
|---------|-----------|
| `lib/autods/*` | Fulfillment commandes AutoDS |
| `lib/woocommerce-compat/*` | Tracking commandes Woo |
| `lib/radar/writers/standard-product-writer.ts` | Écrit Radar DB uniquement |

### Tests

`lib/__tests__/supplier-csv-import.test.ts`, `import-url-scrape.test.ts`, `map-extension-import-product.test.ts`, `url-import-apply.test.ts`, `import-marketplace.test.ts`, `import-ae-catalog-admin.test.ts`

---

## Gestion erreurs & doublons

### Erreurs

- Pattern `{ ok: false, error, status }` dans lib exec
- API JSON `{ error: "..." }` 4xx/5xx
- ScrapingBee fallback si fetch direct incomplet
- Lignes invalides skippées silencieusement dans import exec loop
- Batch > 30 → rejet immédiat
- KYC gate si publish listing affilié sans vérification marchand
- `SupplierIntegration.lastSyncError` pour Shopify

### Doublons

| Mécanisme | Bloque? |
|-----------|---------|
| `checkDuplicate` (titre + image fuzzy) sur preview URL | **Non** — warning `is_duplicate` seulement |
| `aliexpressProductId` unique par supplier | **Oui** — 409 |
| Shopify upsert par `supplierSku` / `sourceUrl` | Update au lieu de create |
| `AffiliateProduct` unique (affiliateId, productId) | Upsert |
| Import standard sans upsert | **Doublons possibles** même URL 2× |

---

## Frictions (score 1 = excellent, 10 = insupportable)

Estimation clics **happy path** (utilisateur connecté, KYC OK).

| Friction | Score | Détail |
|----------|-------|--------|
| **Clics — 1 produit supplier (URL)** | **8/10** | Radar→New (~2) + coller URL (~1) + fetch (~1) + wizard champs (~3–5) + publish (~1) = **~8–10 clics**, sans données Radar pré-remplies |
| **Clics — 1 produit affilié (catalogue)** | **5/10** | Catalogue (~2) + produit (~1) + prix/confirm (~2) + publish (~1) = **~5–6 clics** |
| **Clics — 1 produit affilié (swipe)** | **6/10** | Feed (~2) + swipe (~1) + studio load (~1) + builder (~2–3) + publish (~1) = **~6–8 clics** |
| **Clics — 10 produits affilié** | **9/10** | **~50–80 clics** — pas de multi-select catalogue |
| **Clics — 10 produits supplier URL** | **9/10** | 10× flow URL ou Excel (Excel ~6 clics setup + 10 lignes) |
| **Bulk depuis /radar** | **10/10** | **Inexistant** — 0 winner → Product bridge |
| **Édition avant import** | **4/10** | Supplier: wizard complet. Affilié: `ListingBuilderModal` riche. Radar: rien à éditer |
| **Choix destination** | **9/10** | Affisell shop seulement. Pas Shopify/Woo/TikTok export natif |
| **Images HD** | **5/10** | Scrape garde URLs source; mirror R2 vidéos; pas de pipeline upscale HD garanti |
| **Traduction auto** | **8/10** | Pas de i18n import. Groq rewrite EN/FR optionnel supplier uniquement |
| **Optimisation prix auto** | **6/10** | Markup suggéré swipe; `pricingAutoAdjust` flag listing; pas de moteur Radar→marge |
| **Continuité Radar → import** | **10/10** | Winner perdu au clic Sourcer |
| **Feedback temps d’attente** | **6/10** | Loaders locaux; pas de job queue / progress % multi-produits |
| **Doublons** | **7/10** | Warning faible; doublons URL possibles |
| **Découvrabilité** | **6/10** | Import éclaté (hub, wizard, bulk, extension, AE tab) |

**Score friction global estimé: 7.2/10** — fonctionnel pour supplier power-users, faible pour « 1 clic depuis Radar ».

---

## Ce qui manque pour être le plus puissant du monde

### P0 — Radar → Import bridge (LTV + conversion)

1. **`POST /api/radar/source`** — payload winner (title, imageUrl, country, category, score) → pré-remplit wizard ou crée draft `Product` + `radarSourceMeta` JSON
2. **Bulk select** dans `WorldRadarTerminal` — checkbox 20 winners → queue import
3. **`ImportJob` table** — status, retries, idempotence (`radarWinnerId` + `supplierId` unique)

### P1 — Destination multi-canal

4. **Export connectors** — Shopify Admin push, Woo REST, TikTok Shop (au-delà du pull actuel)
5. **Destination picker** — Affisell catalog | Ma boutique Shopify | Draft only
6. **Sync bidirectionnel** — prix/stock webhook retour

### P1 — Intelligence import

7. **Prix auto** — marge cible depuis `arbitrageScore` + pays Radar
8. **Traduction** — titre/description FR/EN/AR/JP depuis `culturalAffinity` pays
9. **Images** — upscale, fond blanc, galerie min 5, dédup perceptual hash
10. **Catégorie auto** — taxonomy Affisell depuis category Radar + ML

### P2 — UX Bloomberg-grade

11. **1-clic grossiste** — Sourcer = preview inline modal, pas redirect wizard vide
12. **Import queue UI** — progress 31 pays × N produits, Metabase logs `[import]`
13. **Dedup fort** — block ou merge sur `sourceUrl` + image pHash + AE id
14. **Affiliate fast-lane** — depuis Radar producteur: « Lister sur ma boutique » si Product FR existe

### P2 — Ops

15. **Rate limits** — queue ScrapingBee, circuit breaker
16. **Audit trail** — `ImportJob` → Metabase funnel conversion Radar→live Product
17. **Tests e2e** — `curl` radar source + seed + verify Product row

---

## Matrice entry points → résultat

| Entry | User | Clics (~) | DB write | Destination finale |
|-------|------|-----------|----------|-------------------|
| Radar Sourcer | Supplier | 8–10 | `Product` | Catalogue Affisell |
| Radar Voir concurrence | Affiliate | 2 | — | Page winners |
| Catalogue affilié | Affiliate | 5–6 | `AffiliateProduct` | Shop Affisell |
| Swipe feed | Affiliate | 6–8 | `AffiliateProduct` | Shop Affisell |
| URL import | Supplier | 8–10 | `Product` | Catalogue Affisell |
| CSV/Excel | Supplier | 6 + N rows | `Product` | Catalogue Affisell |
| AliExpress API | Supplier | 4–5 | `Product` draft | Catalogue Affisell |
| Extension Chrome | Supplier | 3–5 | `Product` draft | Catalogue Affisell |
| Shopify sync | Supplier | 2 (+ cron) | `Product` upsert | Catalogue Affisell |
| AI import | Supplier | 5–7 | — (preview) | Manuel commit |

---

## Recommandation V2 (architecture cible)

```
WorldRadarTerminal
    │ multi-select winners
    ▼
ImportOrchestrator (new)
    ├── RadarWinnerAdapter (read market_intelli + FR catalog)
    ├── SupplierIngestAdapter (existing executeSupplierProductsImport)
    ├── AffiliateListingAdapter (existing products/add)
    └── ExportAdapter (Shopify/Woo — new)
    │
    ▼
ImportJob (new Prisma model)
    status: queued | scraping | enriching | publishing | done | failed
    idempotencyKey: radar:{country}:{productId}:{userId}
```

**Métrique North Star V2:** `time_to_live_listing` < 60s depuis clic Sourcer sur winner FR avec fournisseur match.

---

## Tests manuels recommandés (post-V2)

```bash
# Preview URL (supplier session)
curl -X POST http://localhost:3001/api/supplier/import-url \
  -H "Cookie: …" -H "Content-Type: application/json" \
  -d '{"url":"https://www.aliexpress.com/item/…"}'

# Commit (max 30)
curl -X POST http://localhost:3001/api/supplier/products/import \
  -H "Cookie: …" -d '{"products":[…]}'

# Affiliate listing
curl -X POST http://localhost:3001/api/affiliate/products/add \
  -H "Cookie: …" -d '{"productId":"…","sellingPriceCents":2999}'
```

---

*Rapport généré par audit codebase — aucun fichier applicatif modifié.*
