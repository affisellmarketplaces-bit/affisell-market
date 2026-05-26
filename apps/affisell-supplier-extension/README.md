# Affisell — Extension import fournisseur

Extension Chrome (Manifest V3) pour importer une fiche produit dans le catalogue fournisseur Affisell.

## Base de données (Prisma)

Le schéma Prisma est à la **racine du monorepo** (`affisell-market/prisma/`), pas dans ce dossier.

Depuis l’extension :

```bash
npm run db:migrate:status   # état des migrations
npm run db:migrate          # appliquer en prod/staging (Neon)
```

Depuis la racine `affisell-market` : mêmes commandes via `npm run db:migrate:status` / `db:migrate`.

Ne pas lancer `npx prisma migrate …` ici : Prisma ne trouvera pas `schema.prisma`.

## Prérequis

1. Appli Affisell en local ou prod (`NEXT_PUBLIC_APP_URL`).
2. Compte **fournisseur** connecté.
3. Jeton généré sur [Dashboard → Extension](/dashboard/supplier/extension).

## Installation (développement)

```bash
cd apps/affisell-supplier-extension
npm install
npm run build
# ou en dev (rebuild auto à chaque modification) :
npm run dev
```

Chrome → `chrome://extensions` → Mode développeur → **Charger l’extension non empaquetée** → dossier `dist/`.

## Utilisation

1. Ouvrir une fiche produit (Amazon, Shopify, Temu, Shein, etc.).
2. Cliquer l’icône Affisell → coller l’URL API + jeton → **Enregistrer**.
3. **Analyser** → prévisualisation.
4. **Enregistrer brouillon** → ouverture de l’édition produit dans Affisell.

**AliExpress** : import direct via API officielle (pas de scrape URL).

## API utilisées

- `GET /api/supplier/extension/session`
- `POST /api/supplier/extension/import-url`
- `POST /api/supplier/extension/products`
- `POST /api/supplier/extension/aliexpress`

Authentification : `Authorization: Bearer afs_ext_…`
