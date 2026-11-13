# Sauvegarde et restauration — procédure d'exploitation

> Finalisation master **J2** (critère 16 : « sauvegardes et restauration documentées »). Avant ce document, il n'existait **aucune** procédure.
> Dernière rédaction : 2026-11-13. Ce document ne contient aucune valeur secrète : les identifiants sont des gabarits `<…>`, les clés
> sont des variables d'environnement de **votre** poste, jamais écrites dans un fichier du dépôt.
>
> **Ce que ce document est — et n'est pas.** C'est une procédure **écrite et relue**, **pas encore exécutée**. Aucune restauration n'a été
> testée dans cette session (aucun accès aux comptes, aucune opération sur des données réelles). Légende :
> **[FAIT]** vérifié dans le code du dépôt · **[À VÉRIFIER]** dépend de votre plan / de la console du service, à confirmer avant de s'y fier ·
> **[À VALIDER]** décision du fondateur · **[NON TESTÉ]** forme de commande écrite de mémoire de la documentation du service, à confirmer
> avec `--help` ou la documentation en ligne **le jour de l'exécution**, jamais pendant un incident pour la première fois.
>
> **La première action utile est la checklist de la §9** : tant qu'une restauration n'a pas été jouée une fois de bout en bout et chronométrée,
> les objectifs de la §2 sont des hypothèses, pas des garanties.

## 1. Ce qu'il faut pouvoir restaurer

| Donnée | Où elle vit | Source de vérité ? | Perte = | Restauration |
|---|---|---|---|---|
| Comptes, commandes, paiements, virements, catalogue, retours, **gel des virements d'un litige** (`Order.status = "disputed"` + lignes de registre `ProcessedWebhook` d'identifiant `dispute:<dp_id>:<orderId>`, D7) | **Neon** Postgres, branche `main` (endpoint `ep-misty-sea-al1ne07p`) — **[FAIT]** schéma `public` + `market_intelli` (Radar, même base) + tables Medusa dans la même base | **Oui** | Irréparable sans sauvegarde | §3 (PITR) + §4 (sauvegarde logique) |
| L'argent réellement déplacé (paiements, remboursements, virements Connect, litiges) | **Stripe** | **Oui, côté argent** — la base n'en est que le reflet | Réconciliation à refaire à la main | §3.7 (réconciliation) — Stripe n'est pas à restaurer, il est à **relire** |
| Compteurs de limitation de débit, bannissements IP, caches IA, états OAuth (10 min), verrous de cron | **Upstash Redis** (clés `affisell:shield:*`, `rl:*`, `radar:*`…, préfixe d'environnement depuis K1) | Non — reconstructibles | Faible : se reconstitue seul | §5 |
| Files BullMQ (`bull:<file>:*`) : `auto-order-place-supplier-order(+dlq)`, `auto-order-batch-fulfill`, `auto-buy`, `order-paid` | **Redis** (`REDIS_URL`) | Non — la **base** est la vérité (les tâches se rejouent depuis les commandes) | Tâches en attente perdues → commandes payées non transmises au fournisseur | §5.3 |
| Photos et vidéos fournisseurs, vitrines, résultats d'essayage, **documents d'inscription (KYC)** | **R2** (priorité), sinon **Vercel Blob**, sinon S3, sinon Supabase — **[FAIT]** `lib/supplier-media-storage-core.ts` ; Blob : `lib/signup-document-storage.server.ts`, `lib/video-storage.ts`, `lib/try-on/*` | **Oui** pour ce que les fournisseurs ont téléversé | Images 404 ; originaux perdus | §6 |
| Configuration : variables Vercel, secrets GitHub, DNS (Cloudflare), webhooks Stripe, projet Sentry | Tableaux de bord des services | Oui, et **non exportable avec les valeurs** (variables *Sensitive*) | Plateforme inopérante jusqu'à reconstruction | §7 |
| Code | GitHub (`origin/main`) | Oui | — | `git`, hors périmètre |

## 2. Objectifs RPO / RTO — **propositions à valider par le fondateur** [À VALIDER]

RPO = perte de données maximale acceptable. RTO = durée maximale d'indisponibilité acceptable. Les colonnes « atteignable aujourd'hui »
sont des **hypothèses** tant que la §9 n'a pas été jouée.

| Composant | RPO proposé | RTO proposé | Atteignable aujourd'hui ? |
|---|---|---|---|
| Neon (restauration à un instant donné) | ≤ 5 minutes (la rétention est continue ; la perte réelle est celle de l'instant choisi) | ≤ 1 heure | **[À VÉRIFIER]** : dépend de la fenêtre de rétention du plan (§3.1) — le plan gratuit n'offre que quelques heures |
| Neon (sauvegarde logique indépendante, §4) | ≤ 24 heures | ≤ 4 heures | Non : **aucune sauvegarde logique n'existe** (à mettre en place) |
| Redis (caches, compteurs) | sans objet (reconstructible) | ≤ 30 minutes (recréer l'instance et mettre à jour 3 variables) | Oui, par construction |
| Redis (files BullMQ) | 0 commande perdue : la base est la vérité | ≤ 1 heure (rejouer depuis la base, §5.3) | **[NON TESTÉ]** |
| R2 / Vercel Blob (originaux téléversés) | ≤ 24 heures | ≤ 4 heures | Non : **aucune copie** n'existe (§6) |
| Configuration (variables, secrets) | 0 (inventaire à jour des **noms** et de l'emplacement des valeurs) | ≤ 2 heures | Non : l'inventaire des valeurs n'existe pas (§7) |

Décisions à prendre : (1) ces chiffres ; (2) le plan Neon qui les permet ; (3) qui exécute le test trimestriel de la §9 ; (4) où sont stockées,
chiffrées, les sauvegardes logiques (compte distinct de celui de Neon, sinon une compromission du compte emporte les deux).

## 3. Neon — restauration à un instant donné (PITR)

### 3.1 Prérequis à vérifier **avant** d'en avoir besoin [À VÉRIFIER]

- **Fenêtre de rétention de l'historique** du projet : c'est la limite dure du PITR (on ne peut pas remonter plus loin). Console Neon →
  projet → **Settings → Storage** (« Restore window » / « History retention »). Par l'API : `history_retention_seconds` dans la réponse de
  `GET /projects/<NEON_PROJECT_ID>` (exemple §3.9). La valeur dépend du plan ; la lire, ne pas la supposer. Si elle est de quelques heures,
  **le PITR ne protège pas d'une erreur découverte le lendemain** : la sauvegarde logique de la §4 devient indispensable.
- **Clé d'API Neon** : Console → *Account settings → API keys*. Créez une clé **personnelle, à durée de vie courte**, conservez-la dans
  votre gestionnaire de mots de passe, exportez-la dans le terminal pour la durée de l'opération (`read -s NEON_API_KEY && export NEON_API_KEY`),
  ne l'écrivez dans aucun fichier.
- **Identifiants à noter une fois** (gabarits `<…>` ci-dessous) : `NEON_PROJECT_ID`, l'identifiant `br-…` de la branche de production (`main`) et
  celui de la branche `staging` (endpoint `ep-shy-wind-aly4bmc7`). Console → projet → *Branches*.
- **Protéger la branche de production** contre la suppression (option « protected branch » de Neon selon le plan) [À VÉRIFIER].
- Les fichiers du dépôt qui reconnaissent la production à son endpoint `ep-misty-sea-…` [FAIT : `grep`] : `lib/db-env.ts`, `lib/env.ts`, `lib/env.pure.mjs`,
  `lib/developer-production-guard.ts` (via `lib/db-env.ts`), `scripts/env-shared.mjs`, `scripts/lib/production-guard.mjs`, `scripts/prisma-explicit-db.mjs`.
  **Conséquence décisive** : la procédure ci-dessous restaure **sur place** (même branche, même endpoint). Une restauration vers une *nouvelle* branche
  donne un *nouvel* endpoint qui n'est plus reconnu comme production par ces gardes — voir §3.8, dernier recours seulement.

### 3.2 Décider : quel type de restauration ?

```text
 L'incident est-il étroit (une table, quelques lignes supprimées / corrompues, découvert vite) ?
   ├─ oui → §3.6 RESTAURATION CIBLÉE : branche de vérification à l'instant T, on ré-injecte seulement ce qui manque.
   │        Aucune donnée postérieure à T n'est perdue. C'est le choix par défaut.
   └─ non (corruption large, migration destructrice, tout est faux depuis T) →
        §3.3 à §3.5 RESTAURATION SUR PLACE de `main` à T, avec sauvegarde de l'état actuel.
        On perd tout ce qui s'est écrit après T : prévoir la réconciliation Stripe (§3.7).
 Neon est-il simplement indisponible ? → ce n'est pas une restauration : suivre l'état du service, ne rien restaurer.
```

**Choisir T** (UTC, à la seconde) : la dernière seconde où la base était saine. Sources pour la fixer : horodatage du déploiement ou de la migration
fautive (journal Vercel, `_prisma_migrations.finished_at`), premier événement Sentry anormal, dernier événement Stripe traité correctement
(`ProcessedWebhook`). Choisissez T **avant** le doute, pas après.

### 3.3 Étape A — créer une branche de vérification à T (non destructif) [NON TESTÉ]

Elle ne modifie pas `main`. Elle sert à constater que T est le bon.

```bash
# NEON_API_KEY exporté dans CE terminal ; NEON_PROJECT_ID et PROD_BRANCH_ID : Console → projet → Branches
curl -sS -X POST "https://console.neon.tech/api/v2/projects/<NEON_PROJECT_ID>/branches" \
  -H "Authorization: Bearer $NEON_API_KEY" -H "Content-Type: application/json" \
  -d '{"branch":{"name":"restore-check-<AAAAMMJJ-HHMM>","parent_id":"<PROD_BRANCH_ID>","parent_timestamp":"<T en UTC, ex. 2026-11-13T10:15:00Z>"},
       "endpoints":[{"type":"read_only"}]}'
```

Forme équivalente en CLI : `neonctl branches create --project-id <NEON_PROJECT_ID> --name restore-check-… --parent <PROD_BRANCH>@<T>` — vérifier la
syntaxe exacte avec `neonctl branches create --help`. Console : *Branches → Create branch → Past data*. Le `read_only` est voulu : la
vérification ne peut rien écrire. La réponse contient l'URL de connexion de la branche (le mot de passe y figure : ne la collez pas dans un
ticket ni un chat). **Mesurez ici le temps de création** : c'est le premier chiffre du RTO.

### 3.4 Étape B — vérifier la branche, en lecture seule

Avec `RESTORE_URL` = l'URL de la branche de vérification, passée **dans la commande** (aucun fichier `.env*`) :

```bash
# 1. Le schéma est-il celui que le code attend ? (lecture seule, imposée par le serveur)
DATABASE_URL="$RESTORE_URL" npm run schema:verify

# 2. L'instant est-il le bon ? Les noms de tables sont ceux de prisma/schema.prisma ("Order", "ProcessedWebhook", "TransferAttempt", "User", "Product")
psql "$RESTORE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SET default_transaction_read_only = on;
SELECT now() AS now, (SELECT max("createdAt") FROM "Order")          AS last_order,
                     (SELECT max("createdAt") FROM "ProcessedWebhook") AS last_webhook,
                     (SELECT count(*) FROM "User")                    AS users,
                     (SELECT count(*) FROM "Product")                 AS products;
SQL
```

Critères de réussite (tous) : `schema:verify` répond « verified » ; `last_order` et `last_webhook` sont **juste avant T** ; les effectifs sont
plausibles (comparer à la production actuelle par les mêmes requêtes) ; la donnée perdue ou corrompue qui motive la restauration **est présente et
saine** sur cette branche. Sinon : choisir un autre T (supprimer la branche de vérification, recommencer §3.3). Si `schema:verify` dit qu'une
migration manque, T est **antérieur** à cette migration : voir §3.5 point 6.

### 3.5 Étape C — restauration sur place de `main` à T [NON TESTÉ]

**Impact** : toutes les connexions à `main` sont coupées pendant l'opération ; **tout ce qui a été écrit après T est retiré de `main`** (il reste
dans la branche de sauvegarde créée ci-dessous). Préparation, dans cet ordre :

1. **Annoncer** l'arrêt (statut, équipe). **Il n'existe pas de mode maintenance dans le code** [FAIT : aucune occurrence] : l'arrêt des écritures n'est
   donc pas garanti — c'est la raison pour laquelle on restaure à un T précis et on réconcilie ensuite (§3.7).
2. **Suspendre les écritures automatiques** : `gh workflow disable "Scheduled crons"` et `gh workflow disable "Process Stripe transfers"`
   (noms dans `.github/workflows/`). Les 20 crons déclarés dans `vercel.json` ne se suspendent pas sans déploiement : leurs écritures pendant la
   fenêtre font partie de ce qui sera réconcilié.
3. **Ne pas désactiver** l'endpoint de webhook Stripe : pendant la coupure il répondra en erreur et **Stripe réessaiera** (plusieurs jours en mode
   live) ; c'est le comportement voulu. Noter l'heure de début.
4. **Restaurer** `main` à T en **préservant l'état actuel** sous un nom :

```bash
curl -sS -X POST "https://console.neon.tech/api/v2/projects/<NEON_PROJECT_ID>/branches/<PROD_BRANCH_ID>/restore" \
  -H "Authorization: Bearer $NEON_API_KEY" -H "Content-Type: application/json" \
  -d '{"source_branch_id":"<PROD_BRANCH_ID>","source_timestamp":"<T>","preserve_under_name":"main-before-restore-<AAAAMMJJ-HHMM>"}'
```

   (Console : *Branches → main → Restore → Restore from history (timestamp)* ; CLI : `neonctl branches restore <PROD_BRANCH> ^self@<T> --preserve-under-name …` —
   vérifier avec `neonctl branches restore --help`.) L'endpoint, l'URL de connexion et donc **toutes les variables Vercel restent identiques** : rien à
   changer, aucun redéploiement.
5. **Vérifier** : refaire les contrôles de la §3.4 contre **l'URL de production** (`DATABASE_URL='<URL_PROD>' npm run schema:verify`, puis les `SELECT`
   en lecture seule), puis ouvrir le site et passer un parcours en lecture (catalogue, connexion).
6. **Si T est antérieur à une migration** appliquée depuis : la base restaurée ne l'a plus, alors que le code déployé l'attend. Réappliquer **avant**
   toute autre chose, avec la procédure de `docs/DEPLOY-SCHEMA-CHANGES.md` §5 :
   `DATABASE_URL='<URL_PROD>' npm run schema:migrate -- --expect-endpoint ep-misty-sea-al1ne07p --confirm-production`, puis `npm run schema:verify`.
7. **Ne PAS réactiver encore les workflows `Scheduled crons` et `Process Stripe transfers`** : ils paient (`process-order-payouts`, `/api/jobs/process-transfers`…) et le registre de litiges vient d'être effacé pour tout litige
   postérieur à T. Passer d'abord par la §3.7 (commandes, puis **litiges**, puis doublons) ; la réactivation est son **dernier** point. Noter l'heure de fin de la restauration elle-même.

### 3.6 Restauration ciblée (incident étroit) — le choix par défaut [NON TESTÉ]

Après §3.3 et §3.4, on ne touche pas à `main` : on **recopie** depuis la branche de vérification uniquement ce qui manque, avec un script SQL écrit et
relu pour ce cas (jamais un `pg_dump | psql` aveugle) :

```bash
# lecture sur la branche de vérification, écriture sur la production : DEUX URL explicites, dans la commande, jamais dans un fichier
pg_dump "$RESTORE_URL" --data-only --no-owner --table='"<Table>"' --column-inserts > /tmp/restore-<table>.sql   # puis RELIRE le fichier
psql "<URL_PROD directe, sans -pooler>" -v ON_ERROR_STOP=1 -f /tmp/restore-<table>.sql
```

Pièges : conflits de clés (utiliser `ON CONFLICT DO NOTHING` après relecture), clés étrangères vers des lignes créées depuis T, séquences. Faire d'abord
l'opération sur une branche de test (`staging` recopiée) ; le garde-fou développeur du dépôt (`AFFISELL_ALLOW_PRODUCTION_WRITES=ep-misty-sea-al1ne07p`) ne
s'applique qu'aux outils du dépôt, pas à `psql` : **la vigilance est humaine**.

### 3.7 Après une restauration sur place : réconcilier avec Stripe (l'argent n'est pas revenu en arrière)

Entre T et la restauration, Stripe a pu encaisser, rembourser, virer, ouvrir ou clore des litiges ; la base ne le sait plus. **Les workflows de paiement restent désactivés (§3.5 point 2) pendant toute cette section.**

1. **Lister côté Stripe** ce qui s'est passé après T : `stripe checkout sessions list --live --limit 100 -d "created[gte]=<T en epoch>"`,
   `stripe refunds list --live -d "created[gte]=<epoch>"`, `stripe transfers list --live -d "created[gte]=<epoch>"`,
   `stripe disputes list --live --limit 100 -d "created[gte]=<epoch>"`, et **les événements de litige émis depuis T** (y compris pour un litige ouvert AVANT T et modifié depuis) :
   `stripe events list --live --limit 100 -d "type=charge.dispute.*" -d "created[gte]=<epoch>"` [NON TESTÉ : flags à confirmer avec `--help` ; Stripe ne conserve les événements que 30 jours].
2. **Commandes d'abord.** Les **sessions payées sans commande** se recréent en **rejouant** l'événement `checkout.session.completed` correspondant :
   `stripe events resend <evt_…> --webhook-endpoint=<we_…> --live` (ou Tableau de bord → Développeurs → Webhooks → l'événement → *Resend*). Les lignes
   `ProcessedWebhook` postérieures à T ont disparu : l'événement sera traité comme neuf.
3. **Danger — doublons de virements** [HYPOTHÈSE à vérifier en base de test] : `createConnectTransfer` (`lib/stripe-connect-transfer.ts`) protège avec la clé
   d'idempotence `tr_<orderId>_<role>`. Une commande recréée par rejeu reçoit un **nouvel** `orderId`, donc une **nouvelle** clé : si le virement avait déjà
   été émis avant la restauration, le rejeu pourrait le **dupliquer**. Avant de rejouer, comparer avec `stripe transfers list --live` pour la même
   `transfer_group`, et ne rejouer que ce qui n'a pas de virement. Ceci est la raison pour laquelle la restauration ciblée (§3.6) est préférable chaque fois qu'elle suffit,
   et pourquoi le RPO de la §2 compte.
4. **Litiges ensuite — avant tout paiement.** Depuis D7, le gel des virements d'une commande en litige **n'existe que dans la base** : `Order.status = "disputed"` **et** une ligne `ProcessedWebhook` d'identifiant `dispute:<dp_id>:<orderId>`
   (statut `dispute_open`, `won`, `lost` ou `closed` ; `lib/orders/dispute-hold.server.ts`). Le déblocage des virements (`process-transfers`, la paie « Lightning », le bonus Légion) ne demande **que** à cette base ; rien ne questionne Stripe. Une restauration à T :
   - **efface** le gel de tout litige ouvert après T (la commande retrouve son statut d'avant, la ligne disparaît), et Stripe **ne renverra pas** l'événement (il a déjà reçu 200) : les virements d'une charge que la banque a déjà reprise seraient **débloqués** ;
   - **rouvre** un litige ouvert avant T et clos depuis (gagné, perdu) : la base le montre encore ouvert, l'événement de clôture ne reviendra pas : gel indéfini, ou — pour un litige perdu — inversion des virements jamais appliquée.
   **Procédure** : (a) pour chaque litige listé au point 1, **rejouer ses événements `charge.dispute.*` dans l'ordre chronologique**, une fois les commandes recréées (point 2) : `stripe events resend <evt_…> --webhook-endpoint=<we_…> --live`. Le gestionnaire (`lib/stripe-dispute.ts`) décide par le **statut** du litige, pas par l'ordre
   des événements, et converge au rejeu (effets d'abord, ligne terminale en dernier, jamais rouverte). (b) **Contrôler** : `SELECT id, status FROM "ProcessedWebhook" WHERE id LIKE 'dispute:%' ORDER BY "createdAt" DESC LIMIT 50;` doit refléter le statut Stripe de chaque litige
   (un litige ouvert = `dispute_open` et la commande `disputed`). (c) Un litige **perdu** dont les inversions de virements avaient déjà été faites chez Stripe avant la restauration : le rejeu les redemande (clé `<dp>:<orderId>`, fenêtre d'idempotence de Stripe : 24 h) ; Stripe doit refuser une inversion déjà complète — **échec visible et alerte, pas un double paiement** [HYPOTHÈSE à vérifier en base de test] : contrôler chaque cas à la main.
   (d) Un événement de litige **plus vieux que 30 jours** n'est plus rejouable : ne **pas** écrire les lignes à la main, suivre la procédure manuelle d'`AGENTS.md` (section « Stripe disputes… »), après avoir alerté.
5. Les crons de guérison (`/api/cron/reconcile-checkout-orders`, `npm run reconcile:checkout`) ne traitent que les commandes **déjà présentes** en `PENDING` :
   ils ne recréent pas une commande absente. De même les lignes `failed` de webhooks postérieures à T ont disparu avec le reste (le rejeu automatique D2 ne les retrouvera pas : les événements se rejouent depuis Stripe, point 2).
6. **Seulement maintenant, réactiver les paiements** : `gh workflow enable "Scheduled crons"` et `gh workflow enable "Process Stripe transfers"`. **C'est le RTO mesuré** (heure de fin − heure de début, §3.5 point 3).
7. Journaliser la réconciliation (qui, quand, quels `evt_` rejoués, quels litiges), puis la clore avec le fondateur.

### 3.8 Dernier recours : promouvoir une branche restaurée (nouvel endpoint) — à NE PAS improviser

Si la restauration sur place est impossible, on peut créer une branche en lecture-écriture à T puis y pointer les variables. **Cela casse les hypothèses du
dépôt** : un endpoint inconnu n'est plus reconnu comme production (`resolveNeonBranchFromHost` → `unknown`), donc `lib/developer-production-guard.ts`, les
gardes des scripts (`scripts/lib/production-guard.mjs`, `scripts/prisma-explicit-db.mjs`) et la garde d'exécution Preview (K1) ne protègent plus la vraie production. Il faut alors, **dans cet ordre** : changer
les marqueurs (`PROD_NEON_MARKER` / `misty-sea`) dans les fichiers listés au §3.1 (un changement de code, testé), mettre à jour `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `DIRECT_URL` (et `RADAR_DATABASE_URL` / `MARKET_INTELLI_DATABASE_URL` s'ils existent) de l'environnement
**Production** de Vercel, redéployer, mettre à jour le secret GitHub si besoin. Décision du fondateur obligatoire.

### 3.9 Retour arrière d'une restauration

- **Annuler une restauration sur place** : l'état d'avant est conservé dans la branche `main-before-restore-<…>` (§3.5 point 4). Pour y revenir :
  même appel `…/branches/<PROD_BRANCH_ID>/restore` avec `"source_branch_id":"<id de la branche main-before-restore-…>"` (sans `source_timestamp` : sa tête).
  Cela ré-écrase `main` avec l'état d'avant la restauration — à ne faire que pour la raison inverse (T mal choisi). Puis refaire §3.5 points 5 à 7.
- **Ne jamais** supprimer `main-before-restore-…` avant d'avoir clos la réconciliation Stripe (§3.7) et attendu la fin de la fenêtre de litige de l'incident.
- Supprimer la branche `restore-check-…` une fois l'incident clos (elle consomme du stockage).
- Lire la fenêtre de rétention (§3.1) : `curl -sS -H "Authorization: Bearer $NEON_API_KEY" https://console.neon.tech/api/v2/projects/<NEON_PROJECT_ID> | jq '.project.history_retention_seconds'`.

## 4. Neon — sauvegarde logique indépendante (à mettre en place) [À VALIDER]

Le PITR est une fonction **du même fournisseur et du même compte** que la base. Il ne couvre ni la compromission du compte, ni une erreur découverte hors de la
fenêtre. Proposition : un `pg_dump` quotidien, chiffré, rangé **hors** du compte Neon.

```bash
# depuis un poste de confiance ; URL DIRECTE (sans -pooler) de la production, passée dans la commande
pg_dump "<URL_PROD directe>" --format=custom --no-owner --file="affisell-$(date -u +%Y%m%dT%H%MZ).dump"
age -r <clé publique age> -o "affisell-….dump.age" "affisell-….dump" && shred -u "affisell-….dump"   # ou gpg ; ne jamais ranger un dump en clair
```

La base contient les schémas `public` (dont les tables Medusa) et `market_intelli` : le dump complet les inclut. Rétention proposée : 7 quotidiens + 4 hebdomadaires +
6 mensuels. **Ne jamais** committer un dump ni le placer dans un dossier du dépôt (il contient des données personnelles — RGPD — et des jetons chiffrés).
Restauration d'un dump : sur une **branche vide de test**, `pg_restore --no-owner --dbname "<URL branche test>" affisell-….dump`, puis `npm run schema:verify` ;
c'est ce qui est exercé dans la checklist (§9). Ce n'est pas un mécanisme que le dépôt automatise aujourd'hui : un planificateur (GitHub Actions sur un runner
dédié, ou une machine à vous) reste à décider.

## 5. Redis (Upstash) et files BullMQ

### 5.1 Ce qui s'y trouve [FAIT : code lu]

| Famille de clés (production : sans préfixe d'environnement) | Rôle | Perte |
|---|---|---|
| `affisell:shield:ban:<ip>`, `affisell:shield:logs` | bannissements IP et journal du bouclier | les bannissements se reconstituent à la prochaine détection |
| `rl:<préfixe>:<clé>`, `radar:scan:rate:*`, `tryon:*`, `growth:winners-quota:*`, `affisell:auto-buy:last-run` | compteurs de limitation | remis à zéro : tolérable |
| `radar:oauth:state:*` | états OAuth (TTL 10 min) | un flux de connexion en cours échoue, on le relance |
| clés de verrou de cron (Radar) | exclusion mutuelle | expirent seules |
| `market:*`, `product:embed:*`, `product-analysis:*`, `margin:*`, `affisell:title-tr:v1:*`, `affisell:taxo-classify*` | caches | se recalculent (coût IA) |
| `bull:auto-order-place-supplier-order:*`, `bull:auto-order-place-supplier-order-dlq:*`, `bull:auto-order-batch-fulfill:*`, `bull:auto-buy:*`, `bull:order-paid:*` | files BullMQ | **tâches en attente perdues** (§5.3) |

Depuis K1 (`lib/redis-namespace.ts`), une Preview écrit sous `preview:…` (files : préfixe `preview:bull`), un poste de développement sous `dev:…`. **Production : aucune clé n'a changé.**
Les clés `preview:*` et `dev:*` sont jetables.

### 5.2 Sauvegarde / restauration de l'instance [À VÉRIFIER]

Upstash persiste les données ; les fonctions de sauvegarde (copie quotidienne, restauration dans la même base) dépendent du plan : Console Upstash → la base → onglet
*Backups* / *Details*. Comme tout est reconstructible **sauf** les files (et celles-ci se rejouent depuis la base, §5.3), la stratégie proposée est : **pas de sauvegarde
périodique obligatoire** ; en cas de perte de l'instance, en recréer une, mettre à jour les trois variables (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `REDIS_URL`)
dans Vercel **Production** et sur l'hôte du worker, redéployer, puis rejouer les files (§5.3).
Deux réglages à contrôler : la politique d'éviction doit être **`noeviction`** (BullMQ l'exige : une éviction supprimerait des tâches en silence) et la région doit être proche de `fra1`.

### 5.3 Rejouer les files après une perte de Redis

La base est la vérité. Pour chaque commande **payée** sans transmission au fournisseur :

1. **Ne rien rejouer tant que l'auto-buy est désactivé** : `AUTO_BUY_ENABLED` n'est pas posé (décision fondateur 2026-11-13, AGENTS.md) → la file `auto-buy` est vide par
   conception ; ne pas la « réparer ».
2. Pour le reste : page admin `/admin/auto-fulfill` (état et relance), route `POST /api/auto-order/retry`, interface `/admin/queues` (Bull Board, nécessite `REDIS_URL`), cron
   `/api/cron/reconcile-checkout-orders`. Contrôler dans la base les commandes `paid` dont le fulfilment n'a pas de `FulfillmentLog` / lot associé.
3. Le worker (`npm run worker:auto-order`, `workers/auto-order-worker.ts`) doit tourner **avec le même espace de noms que Vercel Production** : `NODE_ENV=production` sur son hôte **ou**
   `AFFISELL_REDIS_NAMESPACE=production`. Sans l'un des deux il écoute `dev:bull` et aucune tâche de production n'est consommée — voir `docs/ENVIRONMENTS.md` (transition K1).
4. Risque de **double achat** (G2 du master : cinq déclencheurs parallèles) : avant de relancer une tâche, vérifier qu'aucune commande fournisseur n'existe déjà pour cette commande.

## 6. Stockage de fichiers : R2, Vercel Blob

**Constat** [FAIT : code] : un téléversement fournisseur va sur **R2** si `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_PUBLIC_URL` sont posés, sinon sur Vercel Blob
(`BLOB_READ_WRITE_TOKEN`), sinon S3, sinon Supabase. La base ne stocke que des **URL absolues**. Vercel Blob héberge en outre les documents d'inscription (`signup-document-storage.server.ts`),
les vidéos et les fichiers d'essayage virtuel (ces derniers supprimés par le cron `try-on-retention`).

**Ni R2 ni Vercel Blob ne sont documentés ici comme versionnés ou restaurables à un instant donné** [À VÉRIFIER dans la console de chacun : « object versioning », « lifecycle »,
« soft delete »] : une suppression est à considérer comme définitive. Il n'existe **aucune copie** de ces fichiers aujourd'hui.

Proposition [À VALIDER] :

- **R2** (compatible S3) : copie quotidienne vers un second compartiment **d'un autre compte**, avec une copie qui **n'efface rien** :
  ```bash
  # rclone configuré sur votre poste : « r2-prod » avec des clés R2 en LECTURE SEULE dédiées ; « backup-remote » avec une clé qui peut ÉCRIRE mais pas SUPPRIMER (voir ci-dessous). Aucune clé dans le dépôt.
  rclone copy r2-prod:<bucket> backup-remote:<bucket-backup> --immutable --log-level INFO   # [NON TESTÉ : rclone copy --help]
  ```
  **Pourquoi `copy` et non `sync`.** `rclone sync` rend la destination **identique** à la source : tout fichier supprimé à la source est supprimé dans la sauvegarde au passage suivant. `--immutable` n'interdit que la **modification** d'un fichier existant, pas sa suppression. Avec `sync`, la copie ne protège donc pas
  contre le cas pour lequel elle existe (suppression d'un original : clé R2 compromise — la même clé est dans Vercel —, erreur dans la console, règle de cycle de vie mal écrite) : au plus une journée plus tard l'original disparaît aussi de la sauvegarde, et une source vidée vide la destination.
  `rclone copy` ne supprime jamais côté destination ; avec `--immutable`, un fichier déjà sauvegardé qui **change** à la source (cas attendu rare : les téléversements fournisseurs écrivent des clés horodatées uniques `<userId>/<dossier>/<date>/<horodatage>-<nom>` [FAIT : `lib/supplier-media-storage-core.ts`], et le code ne supprime aucun objet R2 [FAIT : aucun `DeleteObject` dans `lib/`, `app/`, `scripts/`, `workers/`]) est signalé en erreur au lieu d'écraser la sauvegarde — c'est un signal d'alerte, à lire.
  **Rendre la suppression impossible côté sauvegarde** (ceinture et bretelles, [À VÉRIFIER selon le fournisseur de la destination]) : (1) **versionnage d'objets** activé sur le compartiment de sauvegarde et une règle d'expiration des *anciennes versions* après 90 jours ; (2) idéalement un **verrouillage d'objet** (*Object Lock*, mode gouvernance ou conformité) pendant la durée de rétention ; (3) la clé d'écriture de la sauvegarde **sans** les permissions `DeleteObject` / `DeleteObjectVersion`. Ainsi même un poste de sauvegarde compromis ne peut pas effacer l'historique.
  Si, malgré cela, vous voulez un miroir, **jamais** `sync` nu : `rclone sync … --backup-dir backup-remote:<bucket-archive>/<date> --max-delete 50` (les fichiers supprimés ou modifiés partent dans un dossier daté au lieu d'être détruits ; l'opération s'arrête au-delà de 50 suppressions) — à valider par un essai sur un compartiment de test.
  **Restauration** : `rclone copy backup-remote:<bucket-backup> r2-prod:<bucket>` **dans le même compartiment** pour que `R2_PUBLIC_URL` + chemin restent valides (avec versionnage, restaurer d'abord la dernière version non supprimée de l'objet).
  **Contrôle de la sauvegarde** : `rclone check r2-prod:<bucket> backup-remote:<bucket-backup> --one-way` doit lister **zéro** objet manquant dans la sauvegarde.
- **Vercel Blob** : lister puis télécharger régulièrement (le SDK `@vercel/blob` expose `list()` ; la CLI `vercel blob` existe dans les versions récentes [NON TESTÉ : `vercel blob --help`]).
  Les URL Blob ne se recréent à l'identique que si le chemin d'origine (avec son suffixe) est conservé : **essayer** sur un fichier de test avant de compter dessus. Les documents d'inscription sont des données
  personnelles sensibles : la copie doit être chiffrée et soumise à la même politique de rétention que l'original.
- **Reconstruction sans copie** : les images de produits **importés** (AliExpress, etc.) se ré-importent depuis la source ; les originaux **téléversés par des fournisseurs** ne se reconstruisent pas — ce sont eux
  que la copie doit couvrir.

## 7. Configuration et secrets

- **Inventaire** à tenir hors dépôt, dans un gestionnaire de secrets : pour chaque variable de `docs/EXTERNAL-OPS-RUNBOOK.md` §2, **où est la valeur de référence** (service émetteur, gestionnaire) et qui peut la régénérer. `vercel env ls production`
  ne montre que les **noms** (les valeurs *Sensitive* ne sont pas relisibles) : sans inventaire, la perte d'un projet Vercel est une rotation de tous les secrets.
- **Secrets GitHub** (`CRON_SECRET`, `VERCEL_APP_URL`, `VERCEL_DEPLOY_HOOK`, `LHCI_GITHUB_APP_TOKEN`) : même règle ; `CRON_SECRET` doit être identique dans Vercel Production et dans GitHub.
- **Stripe** : la liste des points d'accès de webhook et leurs événements (sortie de `stripe webhook_endpoints list --live`, **sans** les secrets de signature) à archiver à chaque changement.
- **DNS** (Cloudflare) : export de la zone (*DNS → Records → Export*) à archiver ; les enregistrements `*.shops` conditionnent les vitrines marchandes (AGENTS.md).
- Toute **restauration** de configuration est une écriture sur un service externe : hors périmètre des opérations autorisées sans décision du fondateur.

## 8. Ce que ce document ne couvre pas

Reprise après compromission de compte ou de secrets (rotation — procédure séparée), reprise après incident Vercel multi-régions (le projet tourne en `fra1` seule), restauration des données Medusa
indépendamment du reste, conservation légale des journaux. Ces sujets sont à ouvrir séparément.

## 9. Checklist de test de restauration (à jouer avant le lancement, puis chaque trimestre)

Objectif : **mesurer** le RTO réel et prouver que le RPO tient. À faire sur la **branche `staging`** pour la partie destructive ; la production n'est touchée qu'en lecture
(branche de vérification).

- [ ] 0. Date, exécutant, version du document, fenêtre de rétention lue (§3.1) : `________`
- [ ] 1. `NEON_PROJECT_ID`, identifiants de branche, clé d'API courte durée prêts (§3.1) ; `psql`, `pg_dump`, `pg_restore`, `neonctl`, `gh`, `stripe` installés
- [ ] 2. **Création d'une branche de vérification** de la production à T = « il y a 1 heure » (§3.3) — durée : `____` min
- [ ] 3. `DATABASE_URL="<branche de vérification>" npm run schema:verify` → *verified* (§3.4)
- [ ] 4. Les `SELECT` de la §3.4 donnent des `last_order` / `last_webhook` cohérents avec T
- [ ] 5. **Restauration sur place de la branche `staging`** à T' = « il y a 30 min » avec `preserve_under_name` (§3.5, avec les identifiants de **staging**, jamais ceux de production) — durée : `____` min
- [ ] 6. `DATABASE_URL="<staging>" npm run schema:verify` ; ouvrir une Preview (elle pointe sur staging) et passer un parcours en lecture
- [ ] 7. **Retour arrière** de l'étape 5 (§3.9) : l'état d'avant est retrouvé
- [ ] 8. **Sauvegarde logique** : `pg_dump` de la production (§4) → chiffrement → **restauration** (`pg_restore`) sur une branche vide de test → `schema:verify` → comparaison d'effectifs — durée : `____` min
- [ ] 9. **Redis** : recréer une instance de test, la brancher sur une Preview, vérifier que l'application démarre sans erreur `[redis]` et que `[env-validation]` ne signale rien de critique (§5.2)
- [ ] 10. **Fichiers** : restaurer **un** fichier de test depuis la copie (§6) à son URL d'origine et le charger dans un navigateur
- [ ] 11. **Réconciliation** : sur staging avec Stripe en mode **test**, rejouer un `checkout.session.completed` (`stripe events resend …` en mode test) et contrôler l'absence de doublon de virement (§3.7 point 3)
- [ ] 11 bis. **Litige** : ouvrir un litige de test sur une commande de test, restaurer staging **avant** son ouverture, constater que la commande n'est plus `disputed`, rejouer ses événements `charge.dispute.*` (§3.7 point 4) : la commande redevient `disputed`, la ligne `dispute:<dp>:<orderId>` existe, et `process-transfers` ne la paie pas
- [ ] 12. Reporter les durées mesurées dans le tableau ci-dessous, comparer aux objectifs de la §2, corriger la §2 **ou** le dispositif

| Date | Exécutant | Création branche (min) | Restauration sur place (min) | `pg_restore` (min) | RTO total mesuré | RPO atteint | Écarts / actions |
|---|---|---|---|---|---|---|---|
| (à remplir) | | | | | | | |

> Aucune de ces cases n'a été cochée : ce document n'a pas été exécuté. Un test de restauration non réalisé ne prouve rien — le premier passage est précisément celui qui révélera ce que cette
> procédure a de faux.
