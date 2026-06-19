# Audit ÉTAPE 1 — Catégories en arbre & attributs dynamiques

**Projet :** Affisell Marketplace (`affisell-market`)  
**Date :** 2026-06-19  
**Objectif cible :** arbre illimité + attributs dynamiques par catégorie, variantes Parent/Enfant type Amazon  
**Statut :** audit uniquement — **en attente de validation avant ÉTAPE 2**

---

## 1. Synthèse exécutive

Le projet possède **déjà une base avancée** (Google Product Taxonomy FR, ~5,6k nœuds, attributs par catégorie, formulaire vendeur dynamique, filtres marketplace).  
Ce n’est **pas un greenfield** : l’ÉTAPE 2 devra **étendre et normaliser** plutôt que remplacer brutalement.

| Zone | Maturité | Commentaire |
|------|----------|-------------|
| Arbre catégories | 🟢 Fort | 5 595 nœuds, profondeur 7, feuilles 4 719 |
| Attributs dynamiques | 🟡 Partiel | `CategoryAttribute` par catégorie, pas de table `attributes` globale |
| Variantes vendables | 🟡 Partiel | `ProductVariant` + JSON legacy, pas de modèle Parent/Enfant Amazon |
| Valeurs attributs variantes | 🔴 Absent | EAV au niveau **produit** (`ProductAttribute`), pas par variante |
| Admin catégories | 🔴 Minimal | Commission par catégorie seulement, pas de CRUD attributs |
| Import CSV | 🟡 Partiel | Catégorie = string legacy, pas `categoryId` ni specs taxonomy |
| Performance arbre | 🟡 OK à 5k | Cache 120s côté marketplace ; browse charge **tout** en mémoire |

---

## 2. Schéma BDD actuel

> Fichier source : `prisma/schema.prisma`  
> **Il n’existe pas** de tables nommées exactement `categories`, `attributes`, `variant_attribute_values` — noms Prisma PascalCase ci-dessous.

### 2.1 `Category` (≈ `categories`)

| Colonne | Type | Notes |
|---------|------|-------|
| `id` | `String` (cuid) | PK |
| `googleId` | `Int?` | Unique — ID Google Product Taxonomy |
| `name` | `String` | Non unique (feuilles homonymes OK) |
| `slug` | `String` | **Unique global** (`name-googleId`) |
| `icon` | `String` | Défaut `📦` |
| `order` | `Int` | Tri frères |
| `parentId` | `String?` | FK self → `Category.id` |
| `level` | `Int` | 1 = racine (dérivé import) |
| `fullPath` | `String` | Chemin matérialisé texte `"A > B > C"` (**pas** `"1.3.15"`) |
| `isLeaf` | `Boolean` | Index logique feuille |
| `specs` | `String[]` | Noms de specs legacy sur feuille |
| `affisellCommissionRateBps` | `Int?` | Héritage parent si null |
| `supplierCommissionRateBps` | `Int?` | Idem |

**Relations :** `parent` / `children` (self), `products`, `attributes` → `CategoryAttribute[]`, `tabularSubcategories` → `Subcategory[]` (legacy)

**Index :**
- `@@index([parentId])`
- `@@index([level])`
- `Category_googleId_key` (unique)

**Manque vs cible ÉTAPE 2 :** `meta_title`, `meta_desc`, `path` numérique, GIN sur path, `sort_order` dédié (=`order` aujourd’hui)

---

### 2.2 `CategoryAttribute` (≈ pivot catégorie ↔ spec — **pas** table `attributes` séparée)

| Colonne | Type | Notes |
|---------|------|-------|
| `id` | `String` | PK |
| `categoryId` | `String` | FK → `Category` (cascade delete) |
| `key` | `String` | Ex. `storage_gb`, `brand` |
| `label` | `String` | Libellé UI |
| `type` | `String` | TEXT, SELECT, MULTI_SELECT, NUMBER, TEXTAREA… (string libre, pas enum Prisma) |
| `unit` | `String?` | Ex. `Go` |
| `options` | `String[]` | Valeurs SELECT (inline, **pas** table `attribute_options`) |
| `required` | `Boolean` | |
| `order` | `Int` | Tri formulaire |
| `aiSuggest` | `Boolean` | Champ « recommandé » |
| `showInFilter` | `Boolean` | Facette marketplace |
| `validationRule` | `Json?` | `{ min, max, pattern, minLength, maxLength }` |
| `dependsOnKey` | `String?` | Dépendance conditionnelle (ex. modèle Apple si brand=Apple) |
| `dependsOnValue` | `String?` | |
| `helpText` | `String?` | |

**Contraintes :** `@@unique([categoryId, key])`, index `(categoryId)`, `(dependsOnKey)`

**Manque vs cible :** pas de `is_variant`, `is_filterable` séparé de `showInFilter`, pas de `applies_to_descendants`, pas de FK vers entité `Attribute` réutilisable

---

### 2.3 `Product` (parent catalogue — **pas** flag `is_variant_parent` explicite)

Champs taxonomy / variantes pertinents :

| Colonne | Type | Notes |
|---------|------|-------|
| `categoryId` | `String?` | FK → `Category` (normalisé) |
| `subcategoryId` | `String?` | FK → `Subcategory` (legacy tabulaire, **0 row en prod**) |
| `categories` | `String[]` | **Legacy** — labels `AFFISELL_CATEGORIES` (allowlist ~50 dept.) |
| `hasVariants` | `Boolean` | Si true → lignes dans `ProductVariant` |
| `variants` | `Json?` | Legacy merchandising (size/storage presets) |
| `colors` | `String[]` | |
| `customColumns` | `Json?` | Colonnes SKU custom supplier |
| `colorImages` | `Json?` | |
| — | — | Pas de `brand_id`, pas de `slug` produit dédié marketplace |

**Relations :** `productVariants`, `attributes` → `ProductAttribute[]`

---

### 2.4 `ProductVariant` (enfants vendables — modèle **SKU-first**, pas Parent/Enfant Amazon)

| Colonne | Type | Notes |
|---------|------|-------|
| `id` | `String` | PK |
| `productId` | `String` | FK → `Product` |
| `sku` | `String?` | |
| `attributes` | `Json?` | Map AE `{ "Color": "Black", "Size": "M" }` |
| `color` / `size` | `String?` | Colonnes fixes (unique composite avec sku) |
| `supplierPrice` / `publicPrice` | `Decimal` | Prix wholesale / public |
| `stock` | `Int` | |
| `ean` | `String?` | Unique |
| `customData` | `Json?` | Valeurs `customColumns` |
| `wholesalePriceCents`, logistics… | divers | Auto-buy AE |

**Contrainte :** `@@unique([productId, color, size, sku])`

**Manque vs cible :** pas de `variant_attribute_values` typé ; pas de lien vers options d’attributs taxonomy

---

### 2.5 `ProductAttribute` (EAV **au niveau produit**, pas variante)

| Colonne | Type | Notes |
|---------|------|-------|
| `id` | `String` | PK |
| `productId` | `String` | FK → `Product` |
| `key` | `String` | Aligné sur `CategoryAttribute.key` |
| `value` | `String` | Toujours string (SELECT = valeur brute) |
| `label` | `String` | |

**Index :** `(productId)`, `(key, value)`, GIN trigram sur `value` (migration `20260517000000`)

**Usage :** specs remplies par le vendeur + **filtres marketplace** (`attributes: { some: { key, value } }`)

---

### 2.6 `Subcategory` (legacy — **obsolète**)

Table tabulaire 1-niveau sous `Category` (distinct de `Category.children`).  
**État prod : 0 lignes.** Encore référencée par `Product.subcategoryId`.

---

### 2.7 Tables **absentes** (présentes dans le brief cible, absentes du schéma)

| Table cible | Statut |
|-------------|--------|
| `attributes` (entité globale) | ❌ Absente — specs dupliquées par `CategoryAttribute` |
| `attribute_options` | ❌ Absente — `options: String[]` inline |
| `variant_attribute_values` | ❌ Absente |
| `category_templates` | ❌ Absente |

---

### 2.8 Migrations clés

| Migration | Contenu |
|-----------|---------|
| `20260515143000_add_google_taxonomy_category_fields` | `googleId`, `level`, `fullPath`, `isLeaf` |
| `20260515234500_add_category_taxonomy` | `specs[]`, default `isLeaf=false` |
| `20260517000000_category_attribute_amazon_upgrade` | validation, dependsOn, helpText, index trigram ProductAttribute |
| `20260518140000_sku_variants` | `ProductVariant` table |
| `20260526120000_category_affisell_commission_bps` | commission platform par catégorie |

---

## 3. Endpoints API existants

### 3.1 Catégories

| Route | Méthode | Rôle | Payload / query | Réponse |
|-------|---------|------|-----------------|---------|
| `/api/categories` | GET | Arbre marketplace (2 niveaux affichés) | Cookie locale | `{ categories[], catalogTotal, locale, staticFallback? }` |
| `/api/categories/browse` | GET | Arbre complet supplier picker | `?lite=1` optionnel | `{ nodes, rootIds, childrenByParent, leafPaths[], version }` |
| `/api/categories/search` | GET | Recherche feuilles | `?q=&title=` | `{ results: LeafPath[] }` |
| `/api/categories/branch` | GET | Enfants d’un parent (lazy) | `?parentId=` | `{ nodes[], locale }` |
| `/api/categories/breadcrumb` | GET | Fil d’Ariane | `?categoryId=` | Segments path |
| `/api/categories/by-slug/[slug]` | GET | Résolution slug | — | Catégorie + meta |
| `/api/categories/[categoryId]/attributes` | GET | Specs formulaire | — | `{ attributes: CategoryAttributeDto[] }` |

### 3.2 Attributs

| Route | Méthode | Rôle | Notes |
|-------|---------|------|-------|
| `/api/attributes/by-category` | GET | Specs + fallback générique | `?categoryId=` ; stub `__aff_universal_specs__` si vide |

**Résolution :** `lib/category-attribute-resolution.ts` — remonte la chaîne leaf → parents, merge style supplements, fallback brand/material/color.

### 3.3 Produits (supplier)

| Route | Méthode | Rôle | Taxonomy |
|-------|---------|------|----------|
| `/api/supplier/products` | GET/POST | CRUD catalogue | POST : `categoryId` (feuille), `categoryAttributes{}`, variants SKU |
| `/api/supplier/products/[id]` | GET/PUT/DELETE | Édition | Valide specs via `validateVisibleCategoryAttributes` |
| `/api/supplier/products/import` | POST | Import batch JSON | `category` string → legacy `categories[]` only |
| `/api/supplier/suggest-categories-ai` | POST | IA suggestion feuille | |
| `/api/products/classify-category` | POST | IA dept. broad | Retourne labels `AFFISELL_CATEGORIES` |
| `/api/categorize-product` | POST | IA dept. hardcodés | 16 départements fixes |

### 3.4 Admin

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/admin/category-commission-rates/[categoryId]` | PATCH | Commission platform % par catégorie |

**Pas d’API admin CRUD** catégories / attributs / options.

### 3.5 Marketplace / filtres

| Route / lib | Rôle |
|-------------|------|
| `lib/marketplace-attribute-filters.server.ts` | Facettes dynamiques depuis `CategoryAttribute.showInFilter` |
| `lib/marketplace-category-product-filter.ts` | Scope produits par sous-arbre |
| `/api/marketplace/products` | Listing avec filtres attributs |

---

## 4. Fichiers front

### 4.1 Création / édition produit vendeur

| Fichier | Rôle |
|---------|------|
| `app/dashboard/supplier/products/new/page.tsx` | Page wizard |
| `components/supplier/supplier-add-product-form.tsx` | **Formulaire principal** (~3 600 lignes) |
| `components/supplier/supplier-category-picker.tsx` | Picker arbre + recherche feuilles |
| `components/supplier/category-attribute-fields.tsx` | **Champs dynamiques** par catégorie (SELECT, deps, validation) |
| `components/supplier/supplier-variant-table.tsx` | Variantes color/size/sku |
| `components/supplier/ProductWizard.tsx` | Steps wizard |
| `components/product-variants-advanced.tsx` | UI variantes avancées |

**Flux UX actuel :**
1. Vendeur choisit feuille via browse/search/IA  
2. `GET /api/attributes/by-category?categoryId=` charge les specs  
3. `CategoryAttributeFields` affiche champs visibles (dependsOn)  
4. Variantes = table color/size/sku (**pas** dimensions taxonomy type stockage/RAM)  
5. Save → `ProductAttribute` rows + optional `ProductVariant` rows

### 4.2 Marketplace client

| Fichier | Rôle |
|---------|------|
| `app/marketplace/page.tsx` | Listing |
| `app/marketplace/marketplace-filter-sidebar.tsx` | Filtres dept. **hardcodés** `AFFISELL_CATEGORIES` + SmartFilters |
| `app/marketplace/marketplace-view.tsx` | Grille |
| `components/marketplace/CategoryTreeExplorer.tsx` | Explorer arbre |
| `components/marketplace/SmartFilters.tsx` | Filtres rapides |
| `components/layout/CategoryDrawer.tsx` | Nav catégories mobile |

**Écart :** sidebar utilise encore les ~50 départements statiques EN ; l’arbre DB Google FR est surtout côté supplier + rail home.

### 4.3 Admin

| Fichier | Rôle |
|---------|------|
| `app/admin/settings/commission-rates/` | Taux commission par catégorie |

Pas d’UI admin gestion attributs / arbre.

---

## 5. Données existantes (prod/dev DB — 2026-06-19)

Mesures directes sur la base connectée (`.env.local`) :

| Métrique | Valeur |
|----------|--------|
| **Catégories totales** | 5 595 |
| **Feuilles (`isLeaf=true`)** | 4 719 |
| **Profondeur max (`level`)** | 7 |
| **Nœuds profondeur ≥ 4** | 4 033 |
| **Subcategory (legacy)** | 0 |
| **CategoryAttribute** | 112 (sur ~10 aisles seedées Amazon-style) |
| **Produits totaux** | 36 |
| **Produits avec `categoryId`** | 16 (44 %) |
| **Produits avec `categories[]` legacy** | 8 |
| **ProductVariant** | 23 |
| **ProductAttribute** | 26 |

**Top catégories par produits :** profondeur 2–4, ex. « Consoles de jeu vidéo », « Trottinettes », « Ordinateurs portables » (1–2 produits chacune — catalogue test).

**Source arbre :** `prisma/seed.ts` importe `prisma/taxonomy-fr.txt` (Google Product Taxonomy FR, ~5 596 lignes).

**Seeds attributs :**
- `prisma/seed-amazon-attributes.ts` — 10 aisles (Smartphones, etc.)
- `prisma/seed-attributes.ts`, `seed-attributes-complete.ts`
- `prisma/seed-categories.ts` — arbre 12 parents **legacy** (remplacé par Google en prod)

---

## 6. Problèmes détectés

### 6.1 Catégories hardcodées / double taxonomy

| Problème | Où | Impact |
|----------|-----|--------|
| `AFFISELL_CATEGORIES` (~50 dept. EN) | `lib/affisell-categories.ts`, filtres marketplace, import CSV | Désaligné avec arbre Google FR 5,6k |
| `Product.categories[]` allowlist | `lib/supplier-product-attributes.ts` | Import CSV ne peut pas utiliser taxonomy DB |
| Fallback statique arbre | `lib/marketplace-static-categories.ts` | Si DB down, UI 2 niveaux fictifs |
| IA classify broad | `/api/categorize-product` | 16 dept. fixes, pas feuilles Google |

### 6.2 Attributs « fourre-tout » / pas normalisés

| Problème | Détail |
|----------|--------|
| Pas de table `Attribute` globale | Même spec « Couleur » redéfinie par catégorie |
| Options inline `String[]` | Pas de `hex_color`, slug option, i18n |
| Valeurs toujours `string` dans `ProductAttribute` | Pas de NUMBER/BOOLEAN typé en DB |
| Specs au niveau **produit**, pas **variante** | Impossible « Noir 128Go » vs « Blanc 256Go » en EAV propre |
| Seulement **112** CategoryAttribute | 4 719 feuilles sans specs → fallback générique brand/material/color |

### 6.3 Variantes — pas de modèle Parent/Enfant Amazon

| Actuel | Cible Amazon |
|--------|--------------|
| `Product` = fiche unique + flag `hasVariants` | Parent = listing, enfants = ASINs vendables |
| Variantes = `color` + `size` + sku | Dimensions = attributs `is_variant` (stockage, couleur…) |
| `variants` JSON legacy coexiste | Cartographie dimensions ↔ colonnes SKU manuelle |
| Pas de `variant_attribute_values` | Combinaisons invalides non contraintes en DB |

### 6.4 Performance & requêtes

| Zone | Observation | Risque à 10k+ cat. |
|------|-------------|-------------------|
| `/api/categories/browse` | `findMany` **sans pagination** — 5,6k rows OK | ⚠️ Linéaire ; objectif <50ms tenable avec index + cache |
| `fetchAllCategoriesForBrowse` | Charge tout en RAM, build adjacency | OK ~5k, à surveiller >15k |
| Marketplace tree API | **2 niveaux seulement** (root + children) | Profondeur >2 invisible côté acheteur |
| Filtres attributs | `categoryAncestorChainIds` optimisé via graph in-memory | ✅ Bon pattern |
| Résolution attributs formulaire | Walk leaf→root jusqu’à 24 hops, 1 query/chain **ou** batch | 🟡 N+1 possible si non batché |
| Pas d’index GIN sur `fullPath` | Recherche `contains` ILIKE sur feuilles | 🟡 Lent si volume × trafic |

**Mesure arbre non benchmarkée** en CI ; cache Next `unstable_cache` 120s sur `/api/categories`.

### 6.5 Import CSV / intégrations

- `lib/supplier-products-import-exec.ts` : `category` → string dans `categories[]` legacy, **pas** résolution `categoryId`
- Pas de mapping attributs taxonomy à l’import
- Variantes import = color/size/sku JSON, pas dimensions category-driven

### 6.6 Admin & gouvernance

- Pas de CRUD catégories / attributs / templates
- Pas de `category_templates` (titres/descriptions préremplis)
- Commission admin seulement

### 6.7 Tests existants (couverture taxonomy)

~20 fichiers `lib/__tests__/*category*`, `*attribute*`, `*variant*` — dont :
- `category-leaf-guard`, `category-attribute-select-ui`, `marketplace-attribute-filters`
- `category-subtree-graph`, `marketplace-category-listing-counts`
- `product-variant-sku`, `supplier-variant-row-sync`

**Manque :** tests E2E formulaire specs Smartphone (stockage/RAM/5G), tests perf arbre 10k, tests import CSV taxonomy.

---

## 7. Écart brief cible vs existant (matrice)

| Exigence brief | Existant | Gap |
|----------------|----------|-----|
| Arbre illimité | ✅ Self-ref `Category`, prof. 7 | meta SEO, path numérique, GIN |
| `category_attributes` pivot N-N avec `Attribute` | 🟡 `CategoryAttribute` seulement | Entité `Attribute` + options |
| `is_variant` / `is_filterable` / `applies_to_descendants` | 🟡 partiel (`showInFilter`) | Flags + héritage descendants |
| Types enum attributs | 🟡 string libre | Enum strict + UNIT_VALUE |
| `attribute_options` table | ❌ | À créer + migration depuis `options[]` |
| Product parent + variant children | 🟡 Product + ProductVariant | Modèle sémantique Parent/Enfant |
| `variant_attribute_values` EAV | ❌ | À créer ; migrer depuis ProductAttribute? |
| `category_templates` | ❌ | À créer |
| UX auto-specs par catégorie | 🟡 112 feuilles seedées | Seed 300+ feuilles + héritage |
| Rétrocompatibilité | — | Dual-write `categories[]` + `categoryId` requis |

---

## 8. Recommandations pré-ÉTAPE 2 (pour validation)

1. **Ne pas drop** `Category`, `CategoryAttribute`, `ProductAttribute` — migrer par extension.
2. **Introduire** `Attribute` + `AttributeOption` + relier `CategoryAttribute` existant (FK nullable phase 1).
3. **Ajouter** `VariantAttributeValue` sans casser `ProductVariant.color/size` (dual-write phase 1).
4. **Étendre seed** : partir de `seed-amazon-attributes.ts`, cibler 300+ feuilles high-traffic Google.
5. **Unifier** filtres marketplace sur arbre DB (remplacer progressivement `AFFISELL_CATEGORIES`).
6. **Benchmark** : script perf `fetchAllCategoriesForBrowse` + `/api/categories/branch` à 10k nœuds.
7. **Import CSV** : résolution `categoryId` par slug/fullPath + specs keys.

---

## 9. Fichiers de référence (cartographie rapide)

```
prisma/schema.prisma          — modèles Category, CategoryAttribute, Product, ProductVariant, ProductAttribute
prisma/seed.ts                — import Google taxonomy FR
prisma/seed-amazon-attributes.ts
lib/category-browse.ts        — arbre in-memory supplier
lib/category-attribute-resolution.ts
lib/category-attribute-rules.ts
lib/marketplace-category-tree.ts
components/supplier/supplier-add-product-form.tsx
components/supplier/category-attribute-fields.tsx
app/api/categories/*
app/api/attributes/by-category/route.ts
scripts/check-categories.ts   — rapport santé taxonomy
```

---

**⏸ STOP ÉTAPE 1 — En attente de ta validation avant ÉTAPE 2 (migrations + architecture cible).**
