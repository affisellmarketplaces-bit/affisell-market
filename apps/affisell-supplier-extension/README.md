# Affisell — Extension import fournisseur

Extension Chrome (Manifest V3) pour importer une fiche produit dans le catalogue fournisseur Affisell.

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
