# Opérations externes — réglages exacts à faire côté services

> Finalisation master **J2 / K1 / O-3 à O-8**. Dernière rédaction : 2026-11-13. **Rien de ce document n'a été exécuté** : chaque action modifie un service
> externe (Vercel, Stripe, Neon, Replicate, Upstash, Sentry, GitHub), donc relève d'une **autorisation distincte du fondateur** (master §0). Ce document
> prépare les commandes, les vérifications et les retours arrière ; il ne contient **aucune valeur secrète** — les valeurs se lisent dans votre gestionnaire de
> mots de passe, se saisissent dans le terminal (`read -s`) et ne sont écrites dans aucun fichier du dépôt.
>
> Légende : **[FAIT]** vérifié dans le code du dépôt · **[À VÉRIFIER]** chemin de console ou plan à confirmer sur le service · **[NON TESTÉ]** commande écrite de
> mémoire de la documentation du service : confirmer avec `--help` avant de l'exécuter · **⚠** modifie un service externe.
>
> Format de chaque action : **Prérequis → Commande ou chemin → Vérification → Retour arrière.**

## 0. Les actions, par ordre d'urgence

| # | Action | Service | Pourquoi | Réf. |
|---|---|---|---|---|
| A1 | Vérifier/poser les variables **Production** manquantes (§2) — lire la ligne `[env-validation]` du premier démarrage après déploiement | Vercel | une variable critique absente = fonction hors service sans alerte | J3 |
| A2 | Mettre des clés Stripe **test** dans **Preview** (jamais `sk_live_`) + secret de webhook de test | Vercel + Stripe | un Preview ne doit pas pouvoir encaisser (le code refuse désormais la clé live, mais la variable doit être corrigée) | K1, O-6 |
| A3 | Activer les 5 événements `charge.dispute.*` sur le webhook Stripe — **seulement après** le déploiement en production du code D7, validé en mode test (S1, « Ordre sûr ») | Stripe | le code les **traite** (D7) : il **gèle les virements** d'une commande en litige et **inverse automatiquement** les virements d'un litige perdu. Ce n'est pas une simple journalisation | O-6, D7 |
| A4 | Positionner `REPLICATE_WEBHOOK_SECRET` | Replicate + Vercel | active la vérification de signature du webhook d'essayage | O-8 |
| A5 | Worker BullMQ : `NODE_ENV=production` sur son hôte (recommandé) — au minimum `AFFISELL_REDIS_NAMESPACE=production` | hôte du worker | **piège de transition K1** : sans cela le worker écoute `dev:bull` et ne consomme aucune tâche de production, sans erreur. Il le dit maintenant au démarrage (ligne `redis_namespace`, ERREUR + alerte Slack/Discord si le namespace n'est pas choisi) — mais il faut quand même régler l'hôte | K1 |
| A6 | Brancher les **destinataires** des alertes : variables `SLACK_WEBHOOK_URL` / `DISCORD_WEBHOOK_URL` sur Vercel Production, secrets GitHub `CRON_SECRET` + `VERCEL_APP_URL`, notifications GitHub, disponibilité (Better Stack) | GitHub + Vercel + Better Stack + Slack | **le code est fait** (J1 : crons d'argent en mode strict, run rouge, alerte via `/api/cron/notify-failure`) mais l'alerte n'arrive que si ces réglages existent (§9) | O-7, J1 |
| A7 | Plan Neon : fenêtre de rétention PITR, protection de la branche de production | Neon | sans fenêtre suffisante, pas de restauration (BACKUP-RESTORE §3.1) | O-4, J2 |
| A8 | Instance Redis **séparée** pour Preview ; clés `ENCRYPTION_KEY` / `AUTH_SECRET` **distinctes** en Preview | Upstash + Vercel | isolation complète (l'espace de noms est un filet logiciel, pas une frontière) | K1 |
| A9 | Filtrer les alertes Sentry sur `environment:production` | Sentry | Preview a désormais son propre label | K1 |
| A10 | Confirmer le plan Vercel (crons `*/5`, `*/15` vs « Hobby = 1/jour ») | Vercel | des crons peuvent ne pas s'exécuter | O-5 |

## 1. Pré-requis communs

- **Vercel CLI** (`npm i -g vercel`, puis `vercel login`, puis `vercel link` à la racine du dépôt, projet Affisell) — **[NON TESTÉ]** ; **Stripe CLI** (`stripe login`) ; **GitHub CLI** (`gh auth login`) ; `curl`, `jq`.
- Les **trois environnements Vercel** : *Production* (déploiement de `main`), *Preview* (toute autre branche, base `staging` `<ep-staging>`), *Development* (`vercel dev`, rarement utilisé). `VERCEL_ENV` vaut `production` / `preview` / `development` et **c'est lui** — plus `NODE_ENV`,
  qui vaut `production` partout — qui distingue les environnements dans le code (`lib/runtime-environment.ts`).
- Une variable d'environnement Vercel ne s'applique **qu'aux nouveaux déploiements** : après chaque changement, redéployer (`vercel redeploy <url-du-déploiement>` ou Tableau de bord → Deployments → ⋯ → Redeploy).
- **Saisie d'une valeur sans trace** : `read -s VALEUR && printf %s "$VALEUR" | vercel env add NOM production ; unset VALEUR`.
- **Ne pas** exécuter `vercel env pull` sur votre poste pour l'environnement Production : cela ferait de votre portable un hôte détenant les secrets de production (et ferait apparaître un fichier `.env*`, ce qui active les gardes « poste de développeur » du dépôt).

## 2. Matrice des variables d'environnement par environnement Vercel

« **oui** » = requise ; « **test** » = valeur de **test**/**staging** uniquement ; « **jamais** » = ne doit pas exister dans cet environnement ; « — » = sans objet. Le démarrage journalise (`[env-validation]`, noms seulement) ce qui manque en Production et en Preview.

| Variable | Production | Preview | Remarques |
|---|---|---|---|
| `AUTH_SECRET` (ou `NEXTAUTH_SECRET`) | **oui**, 32+ caractères | **oui**, **valeur différente** de la production | sans elle : aucune session lisible, le proxy traite tout le monde en anonyme (erreur journalisée `[proxy] auth_secret_missing_on_request`) |
| `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL` | `https://affisell.com` | URL de la Preview ou `https://staging.affisell.com` [À VÉRIFIER] | |
| `DATABASE_URL` | **oui** : pooler `ep-misty-sea-…` | **test** : pooler `ep-shy-wind-…` | une Preview qui nomme la production : **le client Prisma refuse de se créer** (`[env-guard]`) |
| `DATABASE_URL_UNPOOLED` ou `DIRECT_URL` | **oui** : direct `ep-misty-sea-…` | **test** : direct `ep-shy-wind-…` | doivent nommer **le même** endpoint que `DATABASE_URL` (`docs/DEPLOY-SCHEMA-CHANGES.md` §3) |
| `DATABASE_URL_STAGING` | — | optionnel (référence) | |
| `RADAR_DATABASE_URL`, `MARKET_INTELLI_DATABASE_URL` | seulement si le Radar a sa propre base | **absentes**, ou **test** | nommer la production en Preview : refus identique |
| `CRON_SECRET` | **oui**, **unique** (≠ tout autre secret ; avertissement `cron_secret_reused` sinon) | optionnel, distinct | à reporter à l'identique dans le secret GitHub `CRON_SECRET` |
| `STRIPE_SECRET_KEY` | **oui** : `sk_live_…` | **test** : `sk_test_…` — **`sk_live_` interdit** | une clé live hors production : le client Stripe **refuse** (`[stripe-guard]`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` | `pk_test_…` | |
| `STRIPE_WEBHOOK_SECRET` | **oui** : secret de signature du point d'accès **live** | **test** : celui du point d'accès **de test** | sans lui `/api/webhooks/stripe` répond 503 |
| `STRIPE_PRO_PRICE_ID`, `STRIPE_RADAR_PRO_PRICE_ID`, `STRIPE_RADAR_GLOBAL_PRICE_ID`, `STRIPE_ISSUING_*` | identifiants **live** | identifiants **test** | les identifiants de prix sont **propres à chaque mode** |
| `ENCRYPTION_KEY` (alias `TIKTOK_TOKEN_ENCRYPTION_KEY`) | **oui**, ≥ 32 caractères | **oui, valeur différente** | la branche `staging` a été créée **depuis `main`** (`docs/ENVIRONMENTS.md`) : elle contient des **copies de jetons chiffrés** (AliExpress, TikTok). Avec la clé de production, une Preview pourrait les déchiffrer et agir avec les vrais comptes fournisseurs |
| `PAYOUT_ENCRYPTION_KEY` | 64 caractères hexadécimaux | idem, valeur différente | |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `REDIS_URL` | instance de production | **instance séparée** (A8) | l'espace de noms `preview:` protège déjà les clés si l'instance est partagée |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | oui | peut être le même | les événements portent `environment` = `production` / `preview` / `development` / `unknown` |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | oui (téléversement des cartes sources au build) | optionnel | |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_PUBLIC_URL`, `R2_BUCKET_NAME` ou `BLOB_READ_WRITE_TOKEN` | oui | **compartiment / magasin séparé** | un téléversement de Preview ne doit pas atterrir dans le stockage de production |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | oui | absentes ou domaine de test ; `TEST_EMAIL_TO` | |
| `REPLICATE_API_TOKEN`, `REPLICATE_WEBHOOK_SECRET`, `TRY_ON_ENABLED` | selon l'état de la fonction (`TRY_ON_ENABLED=1` pour l'activer) | optionnel | §6 |
| `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `STORE_CNAME_TARGET` | si domaines marchands | **jamais** | un Preview détenant ce jeton pourrait enregistrer des domaines sur le vrai projet |
| `ALIEXPRESS_*`, `TIKTOK_*`, `AMAZON_*`, `SHOPIFY_*`, jetons de places de marché | oui | **jamais** | comptes réels |
| `SLACK_WEBHOOK_URL` et/ou `DISCORD_WEBHOOK_URL` | **oui** (alertes de cron, litiges, worker — §9 C3) | **absentes** | sans elles, plus aucune alerte d'argent n'est postée |
| `AUTO_BUY_ENABLED` | **ne pas poser** | **ne pas poser** | décision fondateur 2026-11-13 : l'auto-buy dépense l'argent d'Affisell ; l'activer demande une validation métier et financière (le validateur le signale s'il est posé) |
| `AFFISELL_REDIS_NAMESPACE` | **ne pas poser sur Vercel** | **ne pas poser** | réservée à l'hôte d'un worker (§7.2) ; `production` y est **ignoré** sur Vercel Preview / Development |
| `AFFISELL_ALLOW_LIVE_STRIPE_OUTSIDE_PRODUCTION`, `AFFISELL_ALLOW_PRODUCTION_WRITES` | **jamais** | **jamais** | réservées à un poste de développement ; la première est de toute façon ignorée sur Vercel |
| `BUILD_RUN_MIGRATIONS` | **supprimer** | **supprimer** | plus lue par aucun code (`docs/DEPLOY-SCHEMA-CHANGES.md` §9) |
| `LISTING_READINESS_MODE` | `warn` (défaut) → `enforce` après `npm run report:listing-readiness` | `warn` | AGENTS.md |
| `DEMO_LAB_PASSWORD` | `DEMO_LAB_ENABLED=1` seulement si voulu | **oui** (Demo Lab automatique) | AGENTS.md |

**Lister ce qui existe** (noms seulement) : `vercel env ls production`, `vercel env ls preview`. **Ajouter** : `read -s V && printf %s "$V" | vercel env add NOM production ; unset V` (pour Preview : `vercel env add NOM preview`, laisser vide la
question « branche Git » pour toutes les branches Preview). **Supprimer** : `vercel env rm NOM production`. Pour marquer une variable *Sensitive* (valeur non relisible ensuite) : option `--sensitive` de `vercel env add` [NON TESTÉ : `vercel env add --help`].

## 3. Vercel

### V1 — Variables par environnement (A1, A2, A8)

- **Prérequis** : §1 ; valeurs de référence dans votre gestionnaire ; accord du fondateur.
- **Commande** : voir §2. Ordre : d'abord **Preview** (corriger `STRIPE_SECRET_KEY` → `sk_test_…`, `DATABASE_URL*` → staging, `ENCRYPTION_KEY` et `AUTH_SECRET` distincts, retirer tout `VERCEL_API_TOKEN` / jeton de place de marché), ensuite **Production**.
- **Vérification** : redéployer, puis Tableau de bord → projet → **Logs** → filtrer `[env-validation]` : une ligne `result: "ok"` (ou `warnings` avec seulement ce que vous avez choisi de laisser). `result: "critical"` liste les **noms** à corriger.
  Pour Preview : dans le **journal de build**, la ligne `[schema]   DATABASE_URL → ep-shy-wind-…-****` doit nommer la branche staging (une Preview qui nomme la production **échoue au build**, exit 2).
- **Retour arrière** : ré-ajouter l'ancienne valeur (`vercel env add`) ou `vercel env rm`, puis redéployer ; en urgence, **Instant Rollback** (§ ci-dessous) ramène le déploiement précédent **avec ses variables d'alors**.

### V2 — Retour arrière d'un déploiement

- **Tableau de bord** : Deployments → déploiement sain précédent → ⋯ → **Instant Rollback** (Production). **CLI** : `vercel rollback <url-du-déploiement>` [NON TESTÉ].
- Le retour arrière du code **ne revient pas sur la base** : voir `docs/BACKUP-RESTORE.md` et `docs/DEPLOY-SCHEMA-CHANGES.md` (migrations additives seulement).

### V3 — Protection des déploiements Preview [À VÉRIFIER selon le plan]

Settings → **Deployment Protection** → *Vercel Authentication* pour les Preview : elles tournent sur une base de staging (copie de la production) et ne doivent pas être publiques ni indexées.

### V4 — Plan et crons (A10)

Settings → *Billing* / *Plan*. `vercel.json` déclare 20 crons dont deux en `*/5`. Le workflow `.github/workflows/scheduled-crons.yml` indique « Vercel Hobby crons are once/day » : confirmer le plan réel ;
sur un plan qui limite la fréquence, les crons `*/5` (`boost-expire`, `end-expired-battles`) ne s'exécutent pas comme déclaré.

## 4. Neon

### N1 — Fenêtre de restauration et protection de la production (A7)

- **Prérequis** : accès propriétaire au projet ; clé d'API personnelle (BACKUP-RESTORE §3.1).
- **Chemin** : Console → projet → **Settings → Storage** : lire la *restore window* ; choisir un plan qui couvre l'objectif de RPO validé (BACKUP-RESTORE §2). Branche `main` → **Protect** (empêche la suppression) [À VÉRIFIER selon le plan].
- **Vérification** : `curl -sS -H "Authorization: Bearer $NEON_API_KEY" https://console.neon.tech/api/v2/projects/<NEON_PROJECT_ID> | jq '.project.history_retention_seconds'` (aucun secret dans la sortie).
- **Retour arrière** : redescendre la fenêtre (le coût suit) — **mais** une fenêtre réduite supprime l'historique plus ancien : ne le faire qu'en connaissance de cause.

### N2 — Trois URL, un seul endpoint

`DATABASE_URL` (pooler), `DATABASE_URL_UNPOOLED`, `DIRECT_URL` : le **même** `ep-…` ; sinon `schema:verify` refuse (exit 2). Console → *Connection details* (cocher/décocher « Pooled connection »). Vérifier :
journal de build Vercel, lignes `[schema]   DATABASE_URL → ep-…-****`.

### N3 — Branche `staging` : donnée réelle copiée [À VALIDER]

`docs/ENVIRONMENTS.md` : la branche `staging` a été créée **depuis `main`**. Elle contient donc des données personnelles réelles et des jetons chiffrés. Décisions à prendre : (a) accepter, avec des clés de chiffrement **distinctes** en Preview (§2) ; (b) la
recréer depuis une copie **anonymisée**. Tant que (b) n'est pas fait, Preview + Deployment Protection (V3) est la seule barrière d'accès.

### N4 — Mise en veille du calcul (démarrages à froid)

Console → branche `main` → **Compute** → réglage de suspension (« scale to zero » / « suspend after inactivity ») [À VÉRIFIER selon le plan] : les erreurs `P1001` récurrentes sur les crons (master, section 5-J) viennent d'un réveil lent. Désactiver la mise en veille de la
production a un coût : décision du fondateur.

## 5. Stripe

### S1 — Point d'accès de webhook **live** : URL et événements (A3)

- **Prérequis** : accès au Tableau de bord Stripe **mode live** (ou clé restreinte live avec la permission *Webhook endpoints*) ; la liste actuelle des événements, **sauvegardée avant tout changement** (sortie de `stripe webhook_endpoints retrieve we_… --live`, sans le secret).
- **URL** : `https://affisell.com/api/webhooks/stripe` [FAIT : route principale, `docs/vercel-activation-checklist.md`]. Il existe une route **historique** `/api/stripe/webhook` qui délègue au même processeur : **ne configurer qu'un seul des deux** points d'accès (les deux sont idempotents sur l'identifiant d'événement, mais un double envoi est du bruit).
- **Événements à activer** — ceux que `lib/stripe-webhook-processor.ts` traite [FAIT] :

  | Événement | Effet côté application |
  |---|---|
  | `checkout.session.completed` | crée la commande payée, planifie les virements |
  | `checkout.session.expired` | libère la session |
  | `payment_intent.succeeded` | commission marketplace ; auto-buy (désactivé par défaut) ; commandes « blind dropship » |
  | `charge.refunded` | traite le remboursement |
  | `customer.subscription.updated`, `customer.subscription.deleted` | abonnements Pro / Radar / Growth |
  | `invoice.payment_failed` | échec de paiement d'abonnement |
  | `account.updated` | KYC fournisseurs (voir S2) |
  | **`charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated`** | **à ajouter — et ce n'est PAS un simple enregistrement.** Depuis D7 (`lib/stripe-dispute.ts`, appelé par `lib/stripe-webhook-processor.ts`) le code **décide par le STATUT du litige** : **ouvert** = chaque commande de la charge est **gelée** (`Order.status = "disputed"` + une ligne de registre `ProcessedWebhook` d'identifiant `dispute:<dp_id>:<orderId>`, statut `dispute_open`) : `process-transfers`, la paie « Lightning » et le bonus Légion **ne paient plus** cette commande ; alerte Slack/Discord + message Sentry. **Gagné / clos sans perte** = statut d'avant restauré, ligne close. **Perdu** = appliqué **automatiquement uniquement** si le montant du litige égale ce que nos commandes de la charge représentent (±1 centime par commande) : **inversion des virements Connect**, ligne `OrderStripeRefund` (`dispute_lost`), puis `REFUNDED` / `REFUND_PENDING_CLAWBACK` ; un litige partiel, trop grand ou dans une autre devise **laisse le gel ouvert et alerte un humain** (`skipped`, `dispute_lost_manual_review:<raison>`). Un litige sur une charge **sans commande marketplace** (abonnement Pro / Radar, blind dropship…) est `skipped` avec l'erreur `orders_not_found` et une alerte « Handle it in the Stripe dashboard ». Les e-mails de litige de Stripe restent la seconde protection (Tableau de bord → Paramètres → Notifications par e-mail — adresse surveillée) |

- **Commande** (Tableau de bord : Développeurs → Webhooks → le point d'accès → *Update details* → *Select events*) ; en CLI [NON TESTÉ] : la mise à jour **remplace** la liste entière, donc toujours relire puis renvoyer la liste **complète** :
  ```bash
  stripe webhook_endpoints retrieve we_<ID> --live            # sauvegarder la sortie (liste actuelle d'enabled_events)
  stripe webhook_endpoints update we_<ID> --live \
    -d "enabled_events[]=checkout.session.completed" -d "enabled_events[]=checkout.session.expired" \
    -d "enabled_events[]=payment_intent.succeeded" -d "enabled_events[]=charge.refunded" \
    -d "enabled_events[]=customer.subscription.updated" -d "enabled_events[]=customer.subscription.deleted" \
    -d "enabled_events[]=invoice.payment_failed" -d "enabled_events[]=account.updated" \
    -d "enabled_events[]=charge.dispute.created" -d "enabled_events[]=charge.dispute.updated" -d "enabled_events[]=charge.dispute.closed" \
    -d "enabled_events[]=charge.dispute.funds_withdrawn" -d "enabled_events[]=charge.dispute.funds_reinstated"
  ```
- **Ordre sûr d'activation des 5 événements de litige** (le code déplace de l'argent sur ces événements : on ne les active pas « pour voir ») :
  1. **Le code D7 doit déjà être déployé en Production**, sinon les événements tombent dans le traitement par défaut (`skipped`, aucun gel, aucune inversion) et vous croiriez les litiges couverts. Vérifier : le SHA du déploiement Production
     contient `lib/stripe-dispute.ts` (`git show <sha-déployé>:lib/stripe-dispute.ts | head -3`). **Déployer d'abord, activer ensuite — jamais l'inverse.**
  2. **Valider en MODE TEST sur la Preview / staging** (point d'accès de test, S3) : (a) `stripe trigger charge.dispute.created` → doit donner `skipped` / `orders_not_found` + une alerte 🚨 « matches NO marketplace order » (c'est ce que la fixture
     doit produire : **elle n'exerce ni le gel ni la perte**) ; (b) un **vrai** parcours : payer une commande de test avec la carte de test de litige de Stripe (`4000 0000 0000 0259` [NON TESTÉ : vérifier dans la documentation « Testing disputes »]) → la commande passe `disputed`,
     une ligne `dispute:<dp>:<orderId>` en `dispute_open` apparaît dans `ProcessedWebhook`, l'alerte part, et `process-transfers` **ne paie pas** cette commande ; (c) clore le litige en test (preuve « winning_evidence » = gagné, « losing_evidence » = perdu [NON TESTÉ]) : gagné → statut d'avant
     restauré ; perdu → virements inversés, `OrderStripeRefund` `dispute_lost`. Le gestionnaire n'a **jamais été exercé contre Stripe** : cette étape est la première preuve.
  3. **Activer les cinq en une seule opération** (liste complète ci-dessus) : le gestionnaire est piloté par le statut et ne dépend pas de l'ordre des événements, mais un sous-ensemble laisserait un gel sans événement de clôture.
- **Vérification** : (1) `stripe webhook_endpoints retrieve we_<ID> --live | jq '.enabled_events'` contient les 13 ; (2) rien ne se passe tant qu'aucun litige réel n'existe — **c'est normal** : la preuve se lit au premier litige : Tableau de bord → *Event deliveries* : **200** ; l'alerte Slack/Discord part ; la ligne
  `dispute:<dp>:<orderId>` existe : `SELECT id, status FROM "ProcessedWebhook" WHERE id LIKE 'dispute:%' ORDER BY "createdAt" DESC LIMIT 20;` (lecture seule) ; (3) le journal Vercel montre `stripe_dispute_event` puis `webhook_processed_sync` sans erreur. Sans les variables `SLACK_WEBHOOK_URL` / `DISCORD_WEBHOOK_URL` (§9 C3) **aucune alerte de litige ne part** : le gel, lui, s'applique quand même.
- **Retour arrière** : renvoyer la liste sauvegardée (`update` avec les `enabled_events[]` d'origine). **Ne pas retirer** `charge.dispute.updated`, `.closed`, `.funds_withdrawn`, `.funds_reinstated` **tant qu'une commande est gelée** : l'événement de clôture n'arriverait jamais, la commande resterait `disputed` et ses virements retenus indéfiniment.
  Contrôle avant tout retrait (lecture seule) : `SELECT id FROM "ProcessedWebhook" WHERE id LIKE 'dispute:%' AND status = 'dispute_open';` doit être **vide** ; sinon libérer à la main (régler la commande puis changer le statut de la ligne de registre — procédure `AGENTS.md`, section « Stripe disputes… »).
  **Ne jamais supprimer** le point d'accès live : le secret de signature serait à régénérer partout. Retirer les 8 autres événements, au contraire, **arrêterait** les commandes et les remboursements : ne pas le faire pour « revenir en arrière ».

### S2 — Point de terminaison *Connect* : question ouverte [À VÉRIFIER]

`account.updated` pour les **comptes connectés des fournisseurs** (KYC) n'arrive que sur un point d'accès de type **« Écouter les événements des comptes connectés »**, qui a **son propre** secret de signature. Le code ne lit qu'**un** secret
(`STRIPE_WEBHOOK_SECRET`) : un second point d'accès ne passerait pas la vérification de signature. À contrôler dans le Tableau de bord : de quel type est le point d'accès actuel ? Si les événements de comptes connectés sont nécessaires, **c'est un changement de code** (deux secrets) à décider ; ne pas contourner en
mettant le même secret à deux endroits (impossible : chaque point d'accès a le sien).

### S3 — Mode test pour Preview (A2)

- Un point d'accès de **mode test** vers une URL **stable** de Preview (ex. `https://staging.affisell.com/api/webhooks/stripe` [À VÉRIFIER : ce domaine est-il rattaché à l'environnement Preview ?]) ; son secret de signature (mode test) va dans `STRIPE_WEBHOOK_SECRET` de **Preview**.
- Clés **test** (`sk_test_…`, `pk_test_…`) et identifiants de prix **test** dans Preview.
- **Vérification** : un paiement avec la carte de test `4242 4242 4242 4242` sur la Preview crée une commande dans la base de **staging** et une seule ; aucune ligne dans la base de production.
- **Retour arrière** : retirer le point d'accès de test (n'affecte pas le live).

### S4 — Séparation des clés

Les clés **live** ne vivent que dans l'environnement **Production** de Vercel. Rotation des clés (secrète, restreinte, secrets de webhook) : **hors périmètre** de ce document (décision et fenêtre à planifier ; rien n'est tourné sans accord). Contrôle : `vercel env ls preview` ne doit contenir **aucune** valeur dont vous savez qu'elle est `sk_live_…`
(le validateur et le client Stripe la refusent de toute façon).

## 6. Replicate — secret de signature du webhook d'essayage (A4)

- **Prérequis** : `REPLICATE_API_TOKEN` (celui déjà configuré pour l'essayage) disponible dans votre terminal ; `TRY_ON_ENABLED` : la fonction est **désactivée par défaut** — ce réglage n'a d'effet que si elle est activée. Le webhook (`/api/try-on/webhook`) fonctionne **sans** secret
  (le corps n'est jamais cru : seul l'identifiant de prédiction est lu, le statut et la sortie sont relus chez Replicate) ; le secret ajoute la vérification de signature [FAIT : `app/api/try-on/webhook/route.ts`, `lib/try-on/replicate-webhook-verify.ts`].
- **Commande** [NON TESTÉ : documentation Replicate « Webhooks »] :
  ```bash
  # le secret de signature de VOTRE compte Replicate (format whsec_…) ; ne pas l'afficher, le passer directement à Vercel
  curl -sS -H "Authorization: Bearer $REPLICATE_API_TOKEN" https://api.replicate.com/v1/webhooks/default/secret | jq -r .key \
    | vercel env add REPLICATE_WEBHOOK_SECRET production
  ```
  Puis, si Preview utilise l'essayage avec son propre jeton Replicate, la même opération avec `preview`. Redéployer.
- **Vérification** (sans secret de signature valide, la route doit **refuser**) :
  `curl -s -o /dev/null -w "%{http_code}\n" -X POST https://affisell.com/api/try-on/webhook -H "Content-Type: application/json" -d '{}'` → **401** avec le secret posé ; **400** (« Missing prediction id ») sans secret, avec l'avertissement `webhook_unsigned_no_secret_configured` dans le journal.
  Ensuite une génération d'essayage réelle (en Preview) doit aboutir (l'événement signé par Replicate passe).
- **Retour arrière** : `vercel env rm REPLICATE_WEBHOOK_SECRET production` puis redéployer : le webhook retombe sur le mode « corps non cru, sans signature », qui fonctionne.
- La rotation du secret de signature Replicate n'est pas décrite ici (une rotation invalide immédiatement la vérification tant que la variable n'est pas mise à jour).

## 7. Redis (Upstash) et worker BullMQ

### U1 — Instance Redis séparée pour Preview (A8)

- **Chemin** : Console Upstash → *Create database* (région proche de `fra1`) → copier l'URL REST, le jeton REST et l'URL `rediss://` → variables `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `REDIS_URL` de **Preview** (§2). **Politique d'éviction `noeviction`** (BullMQ).
- **Vérification** : déployer une Preview, la visiter, puis `redis-cli -u "$PREVIEW_REDIS_URL" --scan --pattern '*' | head` : des clés `preview:…` ; sur l'instance de **production** : `redis-cli -u "$PROD_REDIS_URL" --scan --pattern 'preview:*' | head` : **rien**.
- **Retour arrière** : remettre les anciennes valeurs dans Preview (l'espace de noms `preview:` continue de séparer les clés) ; supprimer l'instance.

### U2 — Hôte du worker : espace de noms de production (A5) — **piège de transition K1**

Depuis K1 chaque clé et chaque file passe par `lib/redis-namespace.ts` : **production = aucun préfixe**, Preview = `preview:`, développement = `dev:`. Vercel Production enqueue donc sous `bull:…` (inchangé). Un **worker** (`workers/auto-order-worker.ts`) qui tourne **hors Vercel**
doit tomber dans le même espace : **`NODE_ENV=production`** sur l'hôte (**recommandé** : c'est aussi ce qui autorise une clé Stripe live dans ce processus — la garde de K1 juge l'environnement d'exécution ; Railway ne fixe pas forcément cette variable au runtime [À VÉRIFIER]) ou, au minimum,
`AFFISELL_REDIS_NAMESPACE=production` (règle Redis seulement ; elle ne change pas la garde Stripe). **Sinon il écoute `dev:bull:…` et plus aucune tâche de production n'est consommée.**
- **Détection à l'exécution** (revue du lot, #13/#30) : au démarrage le worker écrit **toujours** une ligne `[auto-order-worker] redis_namespace` avec le namespace réellement utilisé (`production`, `dev`, `preview`…), le préfixe BullMQ (`bull`, `dev:bull`…), l'environnement déduit et `explicit` (nom de variable et valeurs
  non secrètes seulement). Si le namespace **n'est pas production** et que `AFFISELL_REDIS_NAMESPACE` n'est **pas** posé (ou est invalide), il écrit en plus une ligne **ERREUR** `redis_namespace_not_production` et envoie une **alerte Slack / Discord** (`SLACK_WEBHOOK_URL` / `DISCORD_WEBHOOK_URL`, §9 C3). Il **ne s'arrête pas** (une alerte visible vaut mieux
  qu'une boucle de redémarrage en production). Sur un poste de développement `dev` est voulu : ignorer l'alerte. Sans webhook configuré, seule la ligne d'erreur existe : **les variables du §9 C3 font partie de ce réglage**.
- **Vérification** : lire le journal de démarrage de l'hôte du worker : `redis_namespace` doit afficher `namespace: 'production'` et `bullmqPrefix: 'bull'` ; aucune ligne `redis_namespace_not_production`. Puis Bull Board (`/admin/queues`) : les files avec des compteurs qui bougent ; `redis-cli -u "$PROD_REDIS_URL" --scan --pattern 'dev:bull:*' | head` → **vide**.
- **Retour arrière** : retirer la variable ; le worker reprend l'espace déduit de son `NODE_ENV` (et alerte s'il n'est pas production).
- Un worker qui doit servir les files d'une Preview : `AFFISELL_REDIS_NAMESPACE=preview`.

### U3 — Nettoyage (facultatif)

Les clés `preview:*` et `dev:*` sont jetables : `redis-cli -u "$REDIS_URL" --scan --pattern 'preview:*' | xargs -n 100 redis-cli -u "$REDIS_URL" del`. **Ne jamais** purger sans préfixe sur l'instance de production (`FLUSHALL` interdit).

## 8. Sentry (A9)

- **Prérequis** : accès administrateur au projet. Les événements portent maintenant `environment` = `production` / `preview` / `development` ; `unknown` signifie « build sans signal Vercel » (à investiguer, jamais à ignorer) ; `test` pour les tests.
- **Chemin** : Alerts → chaque règle d'alerte de problème → condition **Environment = production**. Issues → filtre *Environment* pour séparer Preview.
- **Vérification** : après un déploiement Preview puis Production, Issues → sélecteur d'environnement : les deux apparaissent ; une erreur provoquée en Preview ne déclenche **pas** l'alerte de production.
- **Option DEC-11** (master O-1) : limiter les domaines autorisés et le débit du DSN public (Project Settings → *Client Keys (DSN)* → Configure → *Rate limit* ; *Security & Privacy* → *Allowed Domains*) [À VÉRIFIER]. Un DSN public peut recevoir des événements factices.
- **Retour arrière** : supprimer le filtre de la règle.

## 9. Alertes d'échec de cron et de disponibilité (A6)

**État réel [FAIT : `.github/workflows/scheduled-crons.yml`, `.github/workflows/process-transfers.yml`, `scripts/ci/run-crons.sh`, `scripts/ci/notify-cron-failure.sh`, `app/api/cron/notify-failure/route.ts`]** — le correctif de code (finalisation master **J1**) est **fait** ; l'ancien comportement « `|| echo WARN` qui avale l'échec » **n'existe plus** [OBSOLÈTE : ne pas le supposer] :

- Les **crons d'argent** tournent en **mode `strict`** : toute erreur `curl` ou réponse non 2xx fait **sortir le pas en code 1**, le job et le run passent **rouges**, et un pas `if: failure()` écrit une annotation `::error` puis demande à l'application de poster dans Slack / Discord (`POST /api/cron/notify-failure`, authentifié par `CRON_SECRET`).
  Jobs concernés : `money-crons` (toutes les 30 min : `process-order-payouts`, `retry-pending-clawback`, `reconcile-checkout-orders`, `enforce-supplier-ship-sla`), `reconcile-payouts` (03:00 : `reconcile`, `stripe-health`), `replay-failed-webhooks` (toutes les 6 h : `replay-failed-stripe-webhooks`),
  et le workflow `Process Stripe transfers` (toutes les 15 min : `/api/jobs/process-transfers`).
- Les autres crons tournent en mode `lenient` : un échec est une **annotation `::warning`** et une ligne du résumé, **pas** un run rouge et **pas** d'alerte Slack. `lib/__tests__/cron-schedule-coverage.test.ts` échoue sur une route de cron ni planifiée ni listée comme volontairement non planifiée, et sur un cron d'argent non strict.
- **Ce qui reste à votre charge (réglages, pas du code)** : l'alerte n'arrive **que si** (1) les secrets GitHub `CRON_SECRET` (identique à Vercel Production) et `VERCEL_APP_URL` (origine de production) existent — sinon le pas d'alerte **avertit seulement** et le run rouge est l'unique signal ;
  (2) `SLACK_WEBHOOK_URL` et/ou `DISCORD_WEBHOOK_URL` sont posés sur Vercel **Production** (§C3) — sans eux la route répond `delivered: { slack: false, discord: false }` et **rien n'est posté** ; (3) l'application est joignable (sinon : le run rouge et l'annotation restent). Et un **cron planifié sur le plan Vercel / GitHub qui ne l'exécute pas** reste invisible : c'est le rôle du battement de cœur (C2).

### C1 — Notifications d'échec de workflow GitHub

- **Chemin** : GitHub → votre profil → Settings → **Notifications** → *Actions* → « Send notifications for failed workflows only » (e-mail et/ou web). Dépôt → **Settings → Secrets and variables → Actions** : `CRON_SECRET` (identique à Vercel Production), `VERCEL_APP_URL` = **l'origine de production** (`https://affisell.com`) — `docs/DEPLOY-SCHEMA-CHANGES.md` §9.
- **Vérification de la chaîne d'alerte, sans rien déclencher d'argent** : **ne pas** lancer `gh workflow run "Scheduled crons"` pour « tester » — `workflow_dispatch` exécute **tous** les jobs, dont les crons d'argent en réel (paiements aux fournisseurs). Tester la seule route d'alerte :
  ```bash
  read -s CRON_SECRET     # la valeur de CRON_SECRET de Production, saisie sans écho
  curl -sS -X POST https://affisell.com/api/cron/notify-failure -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json" \
    -d '{"workflow":"Scheduled crons","job":"alert-test","route":"/api/cron/none","runUrl":"https://github.com/<organisation>/<depot>/actions/runs/1"}' | jq .
  unset CRON_SECRET
  ```
  Réponse attendue : `{"ok":true,"delivered":{"slack":true,"discord":false}}` (selon ce qui est configuré) et **un message « 🚨 Cron FAILED — … alert-test » dans le canal**. `delivered` à `false` partout = les variables du §C3 manquent. Le contenu est borné et neutralisé par l'application (`lib/cron/notify-failure.ts`).
  Pour lire l'historique : `gh run list --workflow "Scheduled crons" --limit 5` ; `gh run view <id> --log-failed`.
- **Retour arrière** : réglage personnel, réversible.

### C2 — Disponibilité (Better Stack, déjà utilisé pour les journaux)

- **Prérequis** : compte Better Stack (`LOGTAIL_SOURCE_TOKEN`, `LOGTAIL_URL` déjà documentés : `docs/monitoring-logtail.md`).
- **Chemin** : Better Stack → *Uptime* → *Create monitor* : `https://affisell.com/api/health/db` (attendu **200**), `https://affisell.com/api/health/migrations` (attendu **200**), fréquence 1 à 3 min, canaux : e-mail + Slack. Les routes `health` ne divulguent plus de noms de migration ni de message d'erreur brut (master C4).
- **Option battement de cœur** : un *Heartbeat* Better Stack appelé par la dernière étape du workflow de cron (secret GitHub `BETTERSTACK_HEARTBEAT_URL` — **nom proposé, à créer**) : alerte si le cron **ne s'est pas exécuté**.
- **Vérification** : mettre le monitor en pause/reprise ou viser temporairement une URL en 404 : l'alerte arrive sur chaque canal.
- **Retour arrière** : supprimer ou mettre en pause le monitor.

### C3 — Slack / Discord (alertes applicatives)

- **Variables** [FAIT : `lib/ops-webhook.ts`, `lib/slack/*`] : `SLACK_WEBHOOK_URL`, `SLACK_WEBHOOK_URL_JURIDIQUE`, `DISCORD_WEBHOOK_URL` — dans Vercel **Production** uniquement (en Preview : absentes, pour ne pas alerter pour des données de test).
  **Ce sont les destinataires de TOUTES les alertes d'argent** : échec de cron (`/api/cron/notify-failure`), litige Stripe (D7), webhooks Stripe qui échouent toujours après les relances (rejeu D2), worker BullMQ au mauvais namespace (§7 U2). Sans l'une de ces variables sur Production, ces alertes **ne partent nulle part**.
- **Chemin** : Slack → *Apps* → *Incoming Webhooks* → créer l'URL pour le canal d'exploitation → `read -s V && printf %s "$V" | vercel env add SLACK_WEBHOOK_URL production`.
- **Vérification** : déclencher une alerte applicative connue (ex. via l'outil d'administration qui appelle `lib/ops-webhook.ts`) ou un `curl` de test **vers l'URL Slack** depuis votre terminal.
- **Retour arrière** : `vercel env rm SLACK_WEBHOOK_URL production` ; révoquer le webhook dans Slack.

### C4 — Alertes Vercel (erreurs, durée) [À VÉRIFIER selon le plan]

Projet → **Observability / Alerts** (plans Pro et au-delà) : alerte sur le taux d'erreurs 5xx et sur la durée des fonctions. Les crons à 10 s par défaut (`vercel.json` : `maxDuration: 10` pour `app/api/**`) sont une cause connue d'échecs silencieux : surveiller les erreurs `FUNCTION_INVOCATION_TIMEOUT`.

## 10. Vérification globale et journal d'exécution

Après chaque action, noter ici (copie locale, pas dans le dépôt) : date, exécutant, action (A1…A10), résultat de la vérification, éventuel retour arrière.

| Date | Exécutant | Action | Vérification (résultat) | Retour arrière ? |
|---|---|---|---|---|
| (à remplir) | | | | |

Contrôle final, quand A1 à A9 sont faites : (1) `[env-validation]` : `result: "ok"` en Production **et** en Preview ; (2) aucune ligne `[stripe-guard]` ni `[env-guard]` dans les journaux ; (3) Sentry : alertes filtrées sur `production` ; (4) le test de la route d'alerte (§9 C1, **pas** un `gh workflow run` : il exécuterait les crons d'argent en réel) a posté son message dans le canal ; (4 bis) le journal de démarrage du worker affiche `namespace: 'production'` (§7 U2) ;
 (5) la checklist de restauration de `docs/BACKUP-RESTORE.md` §9 jouée une fois.
