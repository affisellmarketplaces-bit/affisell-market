# Déployer un changement de schéma : migration, vérification, puis code

> Règle d'or : **migration (étape à part, à la main) → vérification du schéma dans le catalogue → build de l'application → déploiement.**
> Le build Vercel **ne migre jamais** : il vérifie, en lecture seule. Un schéma non migré ou une migration en échec **arrête tout** :
> pas de build valide, donc rien à déployer.
> Écrit pour la migration `20261007140000_event_spine` (Data Spine, étape S1) ; vaut pour toute migration additive
> (nouvelles colonnes nullables, nouvelles tables, nouveaux index). Pipeline durci en S1.6, séparation stricte en S1.6.1.

## 1. Pourquoi l'ordre compte

Prisma Client génère, pour chaque `create()` sans `select`, un `INSERT … RETURNING` de **toutes** les colonnes du modèle.
Depuis S1, le modèle `AffisellTrackEvent` en a 22. Trois écrivains existants font un tel `create()` :

| Écrivain | Si les colonnes manquent en base |
|---|---|
| `app/api/track/route.ts` | erreur 500 (balise du carrousel) |
| `app/api/pulse/view/route.ts` | erreur 500 |
| `lib/agent-checkout.ts` (`createCheckoutSession`) | **exception après la création de la session Stripe** : l'acheteur ne reçoit pas son lien de paiement |

Le marché principal (checkout marketplace, webhooks Stripe, commandes, remboursements, retours, fulfillment) ne touche pas
cette table et n'est donc pas concerné. Les 7 lecteurs existants utilisent des `select` / `count` / `groupBy` explicites.

Une migration **additive et nullable** est invisible pour l'ancien code : la base peut toujours être migrée *avant* le code.

## 2. Le pipeline (depuis S1.6.1) : deux étapes séparées

```text
 À LA MAIN, AVANT LE PUSH                      PAR VERCEL, AU PUSH
 ───────────────────────────                   ──────────────────────────────────────────────
 schema:migrate  ──►  (vérifie le catalogue)   schema:verify  ──►  build applicatif  ──►  déploiement
 écrit : migrate deploy                        LECTURE SEULE        ne peut pas écrire
```

`vercel.json` → `buildCommand: node scripts/vercel-build.mjs`, qui n'exécute que quatre étapes, **dans cet ordre, et s'arrête à
la première qui échoue** :

| # | Étape | Écrit dans PostgreSQL ? |
|---|---|---|
| 1 | `npx prisma generate` | non |
| 2 | **SCHÉMA — VÉRIFICATION** : `node scripts/schema-deploy.mjs verify` | **non, et le serveur le garantit** : la session est ouverte avec `default_transaction_read_only=on`, PostgreSQL refuse tout `INSERT` / `UPDATE` / `DELETE` / DDL (SQLSTATE `25006`, même avec `WHERE false`) |
| 3 | `npm run check:client-prisma` | non |
| 4 | **BUILD APPLICATIF** : `npm run build` → `build-isolated.mjs` → `next build` | **jamais** (`lib/build-write-guard.ts`) |

- **Le build ne migre jamais.** `BUILD_RUN_MIGRATIONS` (qui transformait ce build en migration) est **supprimé** : plus lu nulle part, plus
  défini dans `vercel.json`. En plus, `schema-deploy.mjs migrate` **refuse de s'exécuter dans tout contexte Vercel** (exit 2) : même si
  quelqu'un remettait `migrate` dans `vercel-build.mjs`, cela produirait un refus, jamais une migration. Si la variable existe encore dans le
  dashboard Vercel (elle y existait en Production), elle est **sans effet** : supprimez-la, elle n'a plus de sens.
- **`schema:migrate` est une étape à part, locale** : cible vérifiée → état des migrations → `migrate deploy` → état → **catalogue**
  (`verify-event-spine`). Vous la lancez **avant** de pousser, avec une cible explicite (§5). Même chose pour la base de staging des
  Preview : elle se migre à la main (`--expect-endpoint ep-shy-wind-aly4bmc7`).
- `schema:verify` = cible vérifiée → « à jour » → catalogue, en lecture seule. Le build l'exécute ; vous pouvez l'exécuter à la main.
- **Conséquence à connaître** : un push dont le code exige une migration que vous n'avez pas encore appliquée **échoue au build**
  (`exit 5`, message « migration not applied »). C'est le comportement voulu : l'ancien code continue de servir.
- **Codes de sortie** : `0` ok · `2` refusé avant toute action · `3` Prisma n'a pas nommé l'endpoint attendu · `4` migration
  échouée ou état illisible · `5` vérification du schéma échouée. Tout code ≠ 0 arrête le pipeline.
- Les erreurs **passagères** (Neon qui se réveille `P1001`, verrou tenu `P1002`, `P1017`) sont réessayées 6 fois (3 à 20 s) ;
  ensuite c'est un échec. Une erreur SQL n'est **jamais** réessayée.

### Ce qui a été retiré, et pourquoi

| Retiré | Ce que cela faisait | Pourquoi c'est parti |
|---|---|---|
| `fix-p3009-migrations.sql` + `healMigrationHistory` du cron | marquait **terminée** toute migration restée inachevée, sans la rejouer, et effaçait ses `logs` | transformait une migration **échouée** en migration « appliquée » sans preuve |
| `prisma/deploy-repair.sql` | DDL « idempotent » à chaque build | ne recréait que des objets que les migrations `20260524140000`, `20260528140000`, `20260529120000` créent déjà : sans effet sur une base migrée, il ne servait qu'à masquer un écart |
| `db:unlock` avant chaque build | terminait **toute** session détenant **un** verrou advisory | pouvait tuer une transaction de paiement ou de fulfillment (`pg_advisory_xact_lock`, `lib/stripe-marketplace-fulfill.ts`, Medusa) |
| `migrate deploy` en « warn-only » | un échec devenait un avertissement, le build continuait | le nouveau code partait sur un schéma incomplet |
| chargement de `.env*` avec `override: true` | l'`.env.local` d'un portable écrasait l'environnement Vercel | un `vercel build` local visait la base de production |
| `/api/cron/migrate` qui appliquait du SQL | SQL instruction par instruction, **sans transaction**, erreurs `already exists` avalées, migration marquée appliquée | DDL à l'exécution + masquage. La route reste (mêmes URL, mêmes planificateurs) mais **lit seulement** : `200` si rien n'est en attente ou en échec, `503` sinon |

`db:unlock` existe toujours, **à la main**, voir §6. La cause qu'il traitait (verrou orphelin derrière le pooler Neon, P1002) est
devenue rare : les migrations passent par l'hôte direct (`-pooler` retiré).

## 3. Quelle base est visée ? (`scripts/schema-deploy.mjs`)

Une seule source : **`DATABASE_URL` de l'environnement** (aucun `.env` n'est lu). `DATABASE_URL_UNPOOLED` et `DIRECT_URL`, s'ils
existent, doivent nommer **le même endpoint** — avant S1.6 Prisma les préférait à `DATABASE_URL`, une valeur périmée pouvait donc
migrer une autre base que celle de l'application.

| Contexte | Règle |
|---|---|
| Vercel **Production** (`VERCEL=1`, `VERCEL_ENV=production`) | **vérifie seulement** ; refuse staging / local ; refuse l'absence de `DATABASE_URL` |
| Vercel **Preview / Development** | **vérifie seulement** ; doit être **prouvé non-production** : seule la branche staging (`ep-shy-wind-…`) est acceptée. URL de production ⇒ **refus** ; hôte non reconnu ⇒ refus ; pas de `DATABASE_URL` ⇒ étape ignorée (rien à migrer) |
| `VERCEL=1` sur une **machine de développement** (fichiers `.env*` secrets présents) | refusé : `vercel build` en local n'est pas un builder Vercel (voir §7) |
| `VERCEL_ENV` absent ou inconnu | refusé |
| Tout contexte Vercel + `migrate` | **refusé** (exit 2) : « a Vercel build never applies migrations » |
| Local | `schema:migrate` exige `--expect-endpoint <ep>` ; la production exige en plus `--confirm-production` ; `schema:verify` n'exige rien |

Le journal de chaque build commence par la liste `DATABASE_URL → ep-…-**** (endpoint, branche)` : **c'est la preuve à lire dans un
journal de build Vercel** pour savoir quelle base un Preview vise.

## 4. Ce qui ne peut plus arriver

| Avant | Maintenant |
|---|---|
| migration échouée → avertissement → build → déploiement | migration échouée → **exit 4** → pas de build applicatif → pas de déploiement |
| migration échouée → « terminée » au build suivant ou par le cron | une migration en échec **bloque** (`P3009`) tant qu'un humain ne l'a pas annulée (`resolve --rolled-back`, §6) ; il n'existe aucun outil `--applied` |
| `db:unlock` à chaque build | aucun arrêt de session automatique ; outil manuel, ciblé, qui ne touche pas aux verrous de l'application |
| Preview pouvant migrer la production | Preview + URL de production ⇒ **exit 2** |
| `vercel build` en local sur la base de production | refusé (`exit 2`) ; l'isolation S1.5 s'applique aussi |
| `BUILD_RUN_MIGRATIONS=1` transformait le build en migration | variable supprimée ; `migrate` refusé sous Vercel ; le build ne fait que **vérifier**, en session lecture seule |

Reste vrai : un build **Vercel** lit encore la base (génération statique, `SELECT` seulement : le garde de `next build` refuse tout le reste).
**Plus aucune étape du build Vercel n'écrit dans PostgreSQL.**

## 5. Procédure exacte pour déployer S1 en production

À faire **par vous** (rien de ceci n'a été exécuté contre la production). `<URL_PROD>` = l'URL de connexion de la base de
production (endpoint `ep-misty-sea-al1ne07p`). Mettez-la **dans la commande**, pas dans un fichier.

0. **Avant tout** : tests verts, migration relue, staging migré et vérifié.
1. **Contrôle de transition (une seule fois, lecture seule)** — l'ancien pipeline guérissait l'historique à chaque build ; vérifiez
   qu'il ne reste rien d'inachevé :
   ```bash
   DATABASE_URL='<URL_PROD>' npm run prisma:explicit -- status
   ```
   Attendu : seule `20261007140000_event_spine` « not yet applied ». Si Prisma affiche `have failed`, **ne poussez rien** : §6.
2. **État de départ** (lecture seule, doit répondre `ABSENT`) :
   ```bash
   DATABASE_URL='<URL_PROD>' npm run verify:event-spine -- --expect absent
   ```
   Contrôlez que `Target database` nomme `ep-misty-sea-al1ne07p-****` et `branch: production`.
3. **Appliquer et vérifier** (une commande : cible → migration → catalogue ; échoue sur la première anomalie) :
   ```bash
   DATABASE_URL='<URL_PROD>' npm run schema:migrate -- --expect-endpoint ep-misty-sea-al1ne07p --confirm-production
   ```
   Attendu : `[schema] ✓ migrated and verified` et `Event-spine schema: PRESENT`.
4. **Pousser le code** (deux commandes séparées) : `git commit …` puis `npm run push:safe`. Le build Vercel exécutera
   `schema-deploy.mjs verify` (lecture seule) : il constatera que le schéma est à jour et que le catalogue est complet, puis
   construira l'application.
5. **Contrôler** : le journal Vercel (`[schema] ✓ verified`), l'absence de `P2022` / `column … does not exist`, puis
   `DATABASE_URL='<URL_PROD>' npm run schema:verify`.

**L'étape 3 n'est plus facultative.** Pousser sans elle ne casse rien en production — le build échoue à `schema verify` (exit 5) et l'ancien
code continue de servir — mais rien ne se déploie tant que vous n'avez pas migré. Même règle pour la base de staging des Preview.

## 6. Si quelque chose échoue

Rien n'est jamais « réparé » en silence. Lisez le **code de sortie** et le message.

| Signal | Que faire |
|---|---|
| `exit 2` `REFUSED` | la configuration est fausse (Preview sur la production, `DIRECT_URL` périmé, machine de développement…) : corrigez-la dans le dashboard Vercel. Rien n'a été touché. |
| `exit 3` | Prisma ne nomme pas l'endpoint attendu : mauvaise cible. Rien n'a été modifié. |
| `P1001` / `P1002` après les nouvelles tentatives | Neon injoignable, ou un verrou de migration est tenu (une autre migration tourne, ou un verrou orphelin). **Rien n'a été tué.** Diagnostic : `DATABASE_URL='<url>' npm run db:unlock` (lecture seule). Si — et seulement si — une session est listée `TERMINABLE` (elle ne détient que le verrou de Prisma, inactive depuis ≥ 2 min) : `npm run db:unlock -- --terminate --pid <n> --expect-endpoint <ep> [--confirm-production]`. Les verrous de l'application ne sont jamais proposés. |
| `FAILED migration(s)` / `P3009` | une migration précédente a échoué. **Ne poussez rien.** (1) `DATABASE_URL='<url>' npm run schema:verify` pour voir ce qui existe réellement. (2) Retirez à la main ce que la migration ratée a laissé (elle est écrite **sans** `IF NOT EXISTS`, un simple rejeu échouerait sur « already exists »). (3) `DATABASE_URL='<url>' npm run prisma:explicit -- resolve --rolled-back <nom> --expect-endpoint <ep> [--confirm-production]` — il exige que Prisma liste bien cette migration comme échouée. (4) relancez `schema:migrate`. |
| `exit 4`, « state is not readable » | historique divergent ou base non gérée par Prisma Migrate : rien n'est déployé automatiquement ; il faut une décision humaine. |
| `exit 5` | le catalogue ne contient pas ce que le code exige (`ABSENT` / `PARTIAL`) ou une migration est en attente en mode `verify`. Ne déployez pas. |

**Il n'y a pas de `resolve --applied`** dans les outils : déclarer « appliquée » une migration qui a échoué demande la preuve
humaine que le schéma est exact, jamais un script. Si un cas historique l'exige, écrivez cette preuve (comme
`lib/events/schema-check.ts`) avant tout.

## 7. Builds locaux et `vercel build`

- `npm run build` (local, CI) : `scripts/build-isolated.mjs` retire tous les identifiants de base et de cache de l'environnement
  de `next build`, y compris ceux que Next chargerait depuis `.env.local`. Il ne peut atteindre aucune base. `AFFISELL_BUILD_ALLOW_DB=1`
  garde une base **hors production** et refuse si une URL de production est présente.
- **`vercel build` lancé en local** pose `VERCEL=1`, ce qui désactivait l'isolation (c'est ainsi que `vercel build --prod` a tourné sur
  ce poste le 9 juillet). Un vrai builder Vercel n'a **jamais** les fichiers `.env*` secrets (ignorés par git, jamais commités) :
  `VERCEL=1` + un de ces fichiers ⇒ « machine de développement » ⇒ le build est **isolé** comme un build local, et `vercel-build.mjs`
  / `schema-deploy.mjs` **refusent** (`exit 2`). Poussez sur git et laissez Vercel construire.
- **Partout**, `lib/build-write-guard.ts` interdit toute écriture Prisma (modèles, SQL brut, DDL) pendant `next build`, avant même
  d'ouvrir une connexion, quel que soit l'environnement. Une migration est un processus séparé (étape SCHÉMA).

## 8. À ne jamais faire

- `DATABASE_URL=… npx prisma migrate deploy`, `npm run db:migrate`, `npm run migrate:deploy` : `prisma.config.ts` / `prisma-with-env.mjs`
  chargent `.env.local` avec `override: true`, la commande viserait la base **par défaut** (la production), quelle que soit l'URL
  passée. Utilisez `npm run schema:migrate` ou `npm run prisma:explicit`.
- `prisma db push`, `prisma migrate dev`, appliquer un `migrate diff` : la base contient les tables de Medusa et Prisma proposerait de
  les supprimer.
- ajouter un script qui écrit dans `_prisma_migrations`, ou qui marque une migration « appliquée » : un test échoue.
- lancer `vercel build` sur un poste de développement.

## 9. Réglages Vercel (à faire dans le dashboard, par vous)

- **Preview** : `DATABASE_URL`, `DIRECT_URL` **et** `DATABASE_URL_UNPOOLED` doivent désigner la branche staging (`ep-shy-wind-…`) ou
  être absents. Tant qu'un Preview pointe sur la production, ses builds échouent avec `exit 2` (c'est voulu).
- Ouvrez un journal de build Preview récent et lisez les lignes `[schema]   DATABASE_URL → …` : elles prouvent la cible.
- **Supprimez `BUILD_RUN_MIGRATIONS`** des variables Vercel (Production, et Preview si elle y est) : elle n'est plus lue, elle ne peut plus
  rien déclencher, la laisser prête à confusion. (Elle y était, marquée *Sensitive* : sa valeur n'était pas lisible depuis le dépôt.)
- Après le prochain build, lisez la première ligne `[schema]` du journal : `verify · context vercel-production` est la seule forme possible.
- Vérifier que le secret GitHub `VERCEL_APP_URL` désigne la production : `/api/cron/migrate` (diagnostic) est appelé chaque jour.

## 10. Outils de développement : la production « par accident » (S1.6.1)

Sur un poste de développeur, `.env` / `.env.local` contiennent l'URL de **production**, et `@prisma/client` charge `.env` tout seul. Un outil lancé
depuis un portable agit donc sur la production **sans que personne l'ait dit**. C'est ainsi qu'un test unitaire a écrit de faux jetons AliExpress dans
`PlatformOAuthCredential` (corrigé : `vitest-env/no-real-datastores.ts`, test hermétique), et c'est ce que `prisma/clear-products.ts`
(`deleteMany` sur toutes les commandes et tous les produits) permettait sans aucune garde.

Règle, appliquée à **tout** ce qui peut écrire depuis un poste de développeur :

```text
poste de développeur  +  une URL qui nomme l'endpoint de PRODUCTION  +  pas de confirmation explicite   →   REFUS (exit 2 / exception)
```

- **Poste de développeur** = un fichier `.env*` secret est présent dans le dépôt (même critère que pour `vercel build`). Il n'existe sur aucun hôte réel
  (Vercel, Railway, CI) : la garde y est **inerte**, le comportement de production est inchangé.
- **Confirmation explicite**, quand la production est bien ce que vous voulez : `AFFISELL_ALLOW_PRODUCTION_WRITES=ep-misty-sea-al1ne07p npm run <commande>`.
  Elle doit **nommer** l'endpoint (`1` ou `true` ne suffisent pas) ; `redis` pour le Redis partagé.
- **Où** :
  | Voie | Garde |
  |---|---|
  | les 43 scripts autonomes qui créent leur propre client Prisma (`prisma/seed*.ts`, `clear-products.ts`, `scripts/*`) | `assertNotProductionByAccident()` juste avant le client — un test échoue si un nouveau script ne l'appelle pas, ou n'est pas lu et ajouté à la liste des outils prouvés en lecture seule |
  | le CLI Prisma : `db push`, `migrate deploy/dev/reset/resolve`, `db execute`, `db seed` (donc `npm run db:push`, `db:migrate`, `migrate:deploy`…) | `prisma.config.ts`, au chargement de la config, avant toute connexion |
  | `npm run dev`, tout script qui importe `@/lib/prisma`, les workers | `lib/developer-production-guard.ts`, dans l'extension de client la plus externe : **les écritures** vers la production sont refusées, **les lectures passent** (on peut toujours regarder les données de production depuis l'interface locale). Le client « fulfillment » est jugé sur **sa propre** URL (`DIRECT_URL`), qu'`npm run dev:staging` ne remplace pas |
  | `npm run worker:auto-order` | idem, plus le Redis partagé : lancé d'un portable, il consommerait les files de production et passerait de vraies commandes fournisseur |
  | `npm run radar:seed:prod` (`seed-prod-safe.mjs`, prévu pour la production, avec invite interactive) | lance `seed-world-radar.ts`, qui est gardé : il faut en plus `AFFISELL_ALLOW_PRODUCTION_WRITES=<ep>` |
  | `npm run dev:staging` | **corrigé** : il ne remplaçait que `DATABASE_URL` ; `DIRECT_URL` et `DATABASE_URL_UNPOOLED` restaient ceux de `.env.local` (la production), et `fulfillmentPrisma` (écritures FulfillmentGroup / Item de la chaîne de paiement) les préfère : une session « staging » écrivait donc ses lignes de fulfillment **en production**. `applyStagingDevEnv` redirige maintenant les trois |
  | `npm run db:copy` | `DATABASE_URL` (source) **et** `PROD_DB` (destination) : la production y est la cible par conception, la confirmation est donc toujours requise |
- **Lecture seule imposée par le serveur** : `schema:verify`, `prisma:explicit -- status` et `verify:event-spine` ouvrent leur session avec
  `default_transaction_read_only=on`. Mesuré : `prisma migrate status` n'envoie que trois `SELECT` (`SELECT version()`, une vérification du schéma,
  la lecture de `_prisma_migrations`), et PostgreSQL refuserait toute écriture même si Prisma en tentait une.
- **Non couvert, volontairement** : Redis écrit par le serveur de développement (compteurs de limitation de débit, caches : sans enjeu métier) ;
  `scripts/verify-launch-ready.mjs`, qui crée une session de paiement Stripe non payée avec la clé locale (sonde « live » voulue, sans débit) ;
  les envois d'e-mails de `email-manual-suppliers.ts --send` (en simulation par défaut).
