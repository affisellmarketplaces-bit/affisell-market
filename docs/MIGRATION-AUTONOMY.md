# Migration `20261126100000_reseller_autonomy_rule` (PR #25) — protocole

Statut (2026-11-26) : **la migration n'est appliquée sur aucune base réelle.** Elle a été rejouée et vérifiée sur une
base PostgreSQL 16 locale et jetable uniquement. Ce succès local **n'autorise aucune opération** sur staging ni sur
la production.

Pendant tout ce protocole, `COPILOT_AUTOPILOT` **reste désactivé** : non défini, ou toute autre valeur que `on`, sur
Vercel et sur GitHub Actions. Le cron `/api/cron/copilot-autopilot` **n'est pas planifié**.

Outils déjà présents dans le dépôt :
- `npm run schema:migrate` et `npm run schema:verify` (`scripts/schema-deploy.mjs`, voir `docs/DEPLOY-SCHEMA-CHANGES.md`) ;
- `scripts/sql/verify-reseller-autonomy-rule.sql` : contrôle du catalogue, en lecture seule ;
- `scripts/sql/test-reseller-autonomy-limits.sql` : contrôle des limites, entièrement annulé par `ROLLBACK` ;
- `scripts/migration-rollbacks/20261126100000_reseller_autonomy_rule.down.sql` : suppression de la table.

Les trois fichiers SQL ont été testés sur la base locale le 2026-11-26.

## 0. Prérequis

- **Code :** la branche `local/copilot-autonomy` (#25) est à jour, et sa CI `lint-and-unit` est verte sur son dernier commit.
- **Cible :** l'URL **staging** (branche Neon `ep-shy-wind-…`) est passée explicitement dans `DATABASE_URL`, `DIRECT_URL`
  et `DATABASE_URL_UNPOOLED`. Les trois doivent viser le même endpoint. Jamais de `.env*` : le script ne les lit pas.
- **Aucune migration en échec :** si `prisma-explicit-db.mjs status` signale `P3009`, on s'arrête et on applique
  `DEPLOY-SCHEMA-CHANGES.md` §6.

## 1. Vérifier le schéma actuel (lecture seule)

```bash
PGOPTIONS='-c default_transaction_read_only=on' psql "$STAGING_URL" -Atc \
  "SELECT coalesce(to_regclass('\"ResellerAutonomyRule\"')::text, 'absente')"
```
Attendu : `absente`. Si la table existe déjà, on s'arrête : quelqu'un l'a créée en dehors de cette procédure.

## 2. Vérifier l'état des migrations (lecture seule)

```bash
DATABASE_URL="$STAGING_URL" DIRECT_URL="$STAGING_URL" DATABASE_URL_UNPOOLED="$STAGING_URL" \
  npm run prisma:explicit -- status --expect-endpoint ep-shy-wind-<id>
```
Attendu : la **seule** migration en attente est `20261126100000_reseller_autonomy_rule`. Si une autre est en attente,
on s'arrête : elle appartient à une autre PR, qui passe d'abord par sa propre procédure.

## 3. Appliquer en staging

```bash
DATABASE_URL="$STAGING_URL" DIRECT_URL="$STAGING_URL" DATABASE_URL_UNPOOLED="$STAGING_URL" \
  npm run schema:migrate -- --expect-endpoint ep-shy-wind-<id>
DATABASE_URL="$STAGING_URL" DIRECT_URL="$STAGING_URL" DATABASE_URL_UNPOOLED="$STAGING_URL" npm run schema:verify
```
Attendu : sortie `0` pour les deux commandes. Toute autre sortie (2, 3, 4 ou 5) arrête la procédure.

## 4. Contrôler le catalogue et les limites

```bash
PGOPTIONS='-c default_transaction_read_only=on' psql "$STAGING_URL" -f scripts/sql/verify-reseller-autonomy-rule.sql
psql "$STAGING_URL" -v uid="'<id d'un compte démo revendeur>'" -f scripts/sql/test-reseller-autonomy-limits.sql
```
Attendu :
- le contrôle du catalogue donne 6 lignes `ok` : table, 10 colonnes, 4 contraintes CHECK, index unique, clé étrangère,
  aucune autorisation active ;
- le contrôle des limites affiche 3 messages se terminant par `refused` (type `pause`, plafond de +30 %, 0 exécution),
  puis `ROLLBACK`, sans aucune ligne restante.

## 5. Tester les autorisations et les quotas (staging, comptes démo)

Ces tests se font sur un aperçu Vercel lié à staging. Tant que le compte Vercel est bloqué, on peut lancer
`npm run dev` en local avec l'URL staging, qui n'est pas la production.

1. **Accorder.** Dans le hub revendeur, accorder `reprice` (plafond +10 %, 3 exécutions par semaine) en cochant
   le consentement. Attendu :
   - `GET /api/affiliate/copilot/autonomy` renvoie la règle ;
   - une ligne `AuditLog` `copilot.autonomy.grant` existe avec ces limites ;
   - accorder sans `consent: true` renvoie une erreur 400.
2. **Refuser les requêtes d'un autre site.** Un `POST` avec `Origin: https://evil.example` renvoie une erreur 403 et
   n'écrit rien.
3. **Faire tourner l'autopilote, localement seulement.** Dans un shell **local** pointé sur staging, lancer
   `COPILOT_AUTOPILOT=on npx tsx -e "import('./lib/copilot-autonomy.server').then(m => m.runAutopilotForReseller('<id démo>').then(console.log))"`.
   Attendu :
   - **Appliquées :** uniquement des actions `reprice` qui restent sous +10 % ;
   - **Refusées :** chaque action au-delà est sautée avec le motif `price_limit` ;
   - **Traçabilité :** une notification `COPILOT_AUTO_ACTION` et une entrée `copilot.apply` avec `source: "auto"` par action ;
   - **Quota :** `autoRunsInWindow` ne dépasse jamais 3. Relancer quatre fois : la quatrième passe ne donne `weekly_limit`.
4. **Résister à deux exécutions simultanées.** Lancer la commande de l'étape 3 deux fois en parallèle. Attendu :
   - le total appliqué ne dépasse pas le quota ;
   - mesure locale de référence : 20 réservations simultanées pour un quota de 3 donnent exactement 3.

## 6. Vérifier l'annulation et le retrait d'autorisation

1. **Annuler.** Annuler une action automatique depuis le hub, dans les 7 jours. Attendu : la fiche reprend son prix
   précédent et une entrée `copilot.undo` est écrite.
2. **Retirer l'autorisation.** Retirer `reprice`. Attendu :
   - `revokedAt` est renseigné et une ligne `AuditLog` `copilot.autonomy.revoke` est écrite ;
   - en relançant l'étape 5.3, plus rien n'est appliqué, car la réservation exige une autorisation active au moment
     de chaque action.
3. **Réaccorder.** Accorder de nouveau avec un quota plus bas. Attendu : le compteur déjà consommé reste
   (`LEAST(...)`). Le quota n'est jamais remis à zéro.

## 7. Production — uniquement après la décision du propriétaire

C'est la même procédure que les étapes 1 à 4, avec `--expect-endpoint <ep production> --confirm-production`, **avant**
la fusion de #25. Ensuite `schema:verify`, puis fusion. `COPILOT_AUTOPILOT` reste non défini en production. Son
activation et la planification du cron sont des décisions séparées.

## 8. Retour arrière

Du moins au plus destructif :
1. **Couper l'automatisation.** Laisser `COPILOT_AUTOPILOT` non défini : rien ne s'applique automatiquement,
   immédiatement et sans déploiement.
2. **Retirer toutes les autorisations, en gardant la trace :**
   `UPDATE "ResellerAutonomyRule" SET "revokedAt" = NOW(), "updatedAt" = NOW() WHERE "revokedAt" IS NULL;`
3. **Annuler les actions déjà faites.** Les actions automatiques des 7 derniers jours restent annulables une par une
   par chaque revendeur (`copilot.undo`).
4. **Revenir sur le code.** Le code tolère l'absence de la table : il la traite comme « aucune automatisation » et ne
   plante pas.
5. **Supprimer la table, en dernier recours et sur décision du fondateur :**
   `scripts/migration-rollbacks/20261126100000_reseller_autonomy_rule.down.sql`. Ce script ne modifie pas l'historique
   Prisma : `migrate status` continuera d'indiquer la migration comme appliquée. Pour livrer de nouveau la fonction,
   il faudra recréer la table en rejouant `migration.sql` à la main. Ne jamais écrire dans `_prisma_migrations`.
