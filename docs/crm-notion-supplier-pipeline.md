# CRM Suppliers Pipeline — template Notion

Duplique cette structure dans Notion, puis branche l’API pour `/crm` et les scripts Python.

## 1. Créer la base « Suppliers Pipeline »

1. Notion → nouvelle page **CRM Affisell** (ou espace fondateur).
2. `/database` → **Table** — nom : **Suppliers Pipeline**.
3. Colonnes (noms **exactement** comme ci-dessous — l’API est sensible à la casse) :

| Colonne Notion | Type | Détail |
|----------------|------|--------|
| **Name** | Title | Nom du fournisseur |
| **URL site** | URL | Site web |
| **SIRET** | Text | 14 chiffres |
| **Catégorie** | Select | ex. Mode, Tech, Maison… (options libres) |
| **Telegram @** | Text | @handle |
| **Status** | Select | Options **exactes** : `Lead`, `Contacted`, `Call Booké`, `Négociation`, `Onboarded`, `Actif`, `Lost` |
| **Dernier contact** | Date | Dernier touchpoint |
| **Notes** | Text | Commentaires |

## 2. Vues Notion (dans la même base)

### Vue 1 — Kanban par Status

- **+ New view** → **Board**
- Nom : `Kanban Status`
- Group by : **Status**
- Colonnes = chaque valeur du select Status (ordre recommandé ci-dessus)

### Vue 2 — Pipeline Lead + Contacted

- **+ New view** → **Table**
- Nom : `Pipeline actif`
- **Filter** : `Status` **is** `Lead` **OR** `Status` **is** `Contacted`
- Tri suggéré : `Dernier contact` → plus récent en premier

## 3. Intégration Notion (API)

1. [notion.so/my-integrations](https://www.notion.so/my-integrations) → **New integration** → nom `Affisell CRM`.
2. Copier le **Internal Integration Secret** → `NOTION_API_KEY`.
3. Sur la page parente de la base : **⋯** → **Connect to** → `Affisell CRM`.
4. Ouvrir la base en plein écran → URL du type  
   `https://www.notion.so/xxx?v=yyy&...`  
   ou menu **⋯** → **Copy link to view**. L’ID base = segment 32 caractères (avec tirets) dans l’URL → `NOTION_CRM_DATABASE_ID`.

Variables (`.env.local` + Vercel) :

```env
NOTION_API_KEY="secret_..."
NOTION_CRM_DATABASE_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## 4. Affichage Next.js

- Page interne : **`/crm`** (rôle **ADMIN** uniquement).
- Kanban + tableau Lead/Contacted synchronisés en lecture depuis Notion.
- API : `GET /api/crm/suppliers` (même auth admin).

## 5. Push Python

```bash
pip install requests
export NOTION_API_KEY="secret_..."
export NOTION_CRM_DATABASE_ID="..."
python scripts/notion-crm-push-supplier.py \
  --name "Acme Supplies" \
  --url "https://acme.example" \
  --siret "12345678901234" \
  --categorie "Mode" \
  --telegram "@acme_b2b" \
  --status Lead \
  --notes "Prospect salon"
```

Création automatique de la base (optionnel) :

```bash
export NOTION_PARENT_PAGE_ID="page_id_parent"
python scripts/notion-crm-create-database.py
# Copier l'ID affiché dans NOTION_CRM_DATABASE_ID
```

## 6. Checklist conformité

- [ ] Status select = 7 valeurs exactes
- [ ] Intégration connectée à la base
- [ ] `/crm` affiche les fiches après refresh
- [ ] Script Python crée une ligne visible dans Notion + Kanban
