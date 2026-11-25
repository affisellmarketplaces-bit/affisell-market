# Suivi : unicité de `MerchantPayoutLedger.stripeTransferId`

**Statut au 2026-11-25 : vérifié conforme sur staging et sur production.** L'index existe sur les deux bases, il est unique, partiel, valide et actif, et aucune valeur n'est en double. Rien n'a été modifié pour l'obtenir : lecture seule, sur autorisation du fondateur du 2026-11-25.

## 1. Ce que la chaîne de migrations garantit (CI et local)

- La migration publiée `20260705150000_payout_ledger_stripe_link` crée l'index ainsi :
  `CREATE UNIQUE INDEX IF NOT EXISTS "MerchantPayoutLedger_stripeTransferId_key" ON "MerchantPayoutLedger"("stripeTransferId") WHERE "stripeTransferId" IS NOT NULL`
- Dans PostgreSQL, un index unique ordinaire admet déjà plusieurs valeurs NULL. L'index partiel garantit donc **la même chose** que l'index déclaré par Prisma (`stripeTransferId String? @unique`).
- Prisma ne sait pas représenter un index partiel : son diff réclame un `CREATE UNIQUE INDEX` ordinaire sous le même nom. Cet écart est gelé dans la baseline sous l'identifiant `stripe-transfer-unique-partial` (`prisma/schema-drift-baseline.json`).
- La CI rejette toute base où cet index manque ou diffère (test négatif `stripe_unique_removed`).

## 2. Vérification des bases réelles — 2026-11-25

### Méthode (identique sur les deux bases)

- **Outil.** Éditeur SQL de la console Neon, projet `affisell`, base `neondb`.
- **Identification de la base.** Avant chaque exécution, la branche a été vérifiée par l'API de la console, qui indique à quelle branche appartient chaque endpoint, et par la branche présente dans l'adresse. L'endpoint en `ep-shy-wind-…` est la branche `staging` ; l'endpoint en `ep-misty-sea-…` est la branche `production`, la branche par défaut et protégée.
- **Requête.** Une seule requête, encadrée par `BEGIN READ ONLY; SET LOCAL statement_timeout = '15s'; … ROLLBACK;`. Son texte a été contrôlé avant chaque exécution : aucune commande d'écriture.
- **Lecture seule constatée.** La base a renvoyé `transaction_read_only = on`, puis la dernière instruction exécutée a été le `ROLLBACK`.
- **Ce qui a été lu.** Uniquement le catalogue (`pg_index`, `pg_get_indexdef`, `pg_get_expr`, `pg_attribute`) et des comptes. Aucune ligne de données et aucun identifiant de virement n'ont été affichés.

### Résultats

| Contrôle | Staging | Production |
|---|---|---|
| Index présent | oui | oui |
| Définition (`pg_get_indexdef`) | `CREATE UNIQUE INDEX "MerchantPayoutLedger_stripeTransferId_key" ON public."MerchantPayoutLedger" USING btree ("stripeTransferId") WHERE ("stripeTransferId" IS NOT NULL)` | identique |
| Unique (`indisunique`) | oui | oui |
| Partiel, prédicat (`indpred`) | `("stripeTransferId" IS NOT NULL)` | identique |
| Valide / prêt / actif (`indisvalid` / `indisready` / `indislive`) | oui / oui / oui | oui / oui / oui |
| Index portant sur cette colonne | 1 (celui-ci) | 1 (celui-ci) |
| Lignes de la table | 2 | 2 |
| Lignes avec `stripeTransferId` non nul | 2 | 2 |
| Valeurs non nulles en double | 0 | 0 |
| Lignes concernées par un doublon | 0 | 0 |

- **Conformité avec la baseline.** La définition lue est celle que la baseline attend dans son fait de catalogue (`fact.value` de `stripe-transfer-unique-partial`).
- **Réserve de lecture.** La console était affichée à travers la traduction automatique de Chrome. La structure de la définition (unique, `btree`, colonne, prédicat) a été lue sans ambiguïté, mais c'est une lecture d'écran, pas une sortie brute.

### Ce qui reste non prouvé

- **Mêmes chiffres sur les deux bases.** C'est vraisemblable pour une table de 2 lignes si staging a été créée à partir de la production. Ce qui prouve que la seconde exécution visait bien la production, c'est la branche dans l'adresse et l'avertissement « branche protégée » affiché par Neon. Aucune requête discriminante n'a été lancée.
- **Portée.** Le constat vaut pour le 2026-11-25. Un `prisma db push` ultérieur pourrait remplacer l'index partiel par un index ordinaire, ce qui resterait sans danger pour l'unicité. L'index ne pourrait disparaître que par une commande explicite.

**Conclusion : aucune correction n'est nécessaire.** Les étapes 3 et 4 de la procédure ci-dessous restent valables pour une base future ou une base restaurée.

## 3. Rôle réel de l'index dans le code (lu le 2026-11-25)

- **Qui écrit.** `recordMerchantPayoutEntry` (`lib/payout-ledger.ts`) écrit chaque versement. Pour un virement Stripe (`recordStripePayoutSettlement`, `lib/payout-settlement.ts`), la clé `idempotencyKey` est **dérivée du même identifiant de virement**, et cette clé a son propre index unique, non partiel. Rejouer le même virement par ce chemin bute donc d'abord sur la clé. L'index sur `stripeTransferId` est une **seconde barrière** : elle arrête un autre écrivain qui utiliserait une autre clé pour le même virement, par exemple une reprise ou un rattrapage historique.
- **Point faible repéré (non corrigé, décision du fondateur).** `recordMerchantPayoutEntry` intercepte l'erreur Prisma `P2002` (violation d'unicité) et répond « déjà enregistré », à l'intérieur d'une transaction interactive. Dans PostgreSQL, une violation d'unicité **interrompt la transaction** : les instructions suivantes sont ignorées et le `COMMIT` final devient un `ROLLBACK`.
  - Démontré le 2026-11-25 sur un PostgreSQL 16 jetable : après la violation, l'instruction suivante est refusée (`current transaction is aborted`) et rien n'est enregistré. Avec `INSERT … ON CONFLICT DO NOTHING`, la transaction continue normalement.
  - Le comportement exact de Prisma dans ce cas (erreur levée au commit, ou annulation silencieuse) n'a **pas** été démontré.
  - Conséquence possible : sur un rejeu, la partie de la transaction écrite avant l'enregistrement est annulée. Pour le versement Lightning, cela concerne les tentatives de virement et le statut « payé » de la commande ; pour `process-transfers`, la tentative marquée `SUCCESS`.
  - Le risque n'est **pas** un double paiement : la base refuse le doublon. Le risque est un versement réellement effectué chez Stripe mais **non reflété** côté Affisell, qui pourrait ensuite être retenté.
  - Correction proposée, à valider : écrire l'entrée avec `createMany({ skipDuplicates: true })`, qui produit un `ON CONFLICT DO NOTHING`, au lieu d'intercepter `P2002`. C'est déjà la règle suivie pour les traces de lignes non attribuées. Un test sur un vrai PostgreSQL rejouerait le même virement.

## 4. Procédure, si une base future doit être vérifiée

Chaque étape demande une autorisation explicite.

1. **Lecture seule.** Reprendre la requête de la section 2, transaction `READ ONLY` puis `ROLLBACK`, staging d'abord.
2. **Si l'index existe**, qu'il soit ordinaire ou partiel : rien à corriger.
3. **Si l'index manque et qu'il n'y a aucun doublon :**
   - créer une migration dédiée `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS …` ;
   - l'exécuter hors transaction, parce que `CONCURRENTLY` est incompatible avec la transaction de Prisma ;
   - commencer par staging.
4. **Si l'index manque et qu'il y a des doublons :** arrêt. Il faut analyser chaque doublon (versement réel ou ligne en double) et obtenir une décision financière avant toute déduplication. Aucune suppression automatique.
5. **Baseline.** Elle garde son entrée tant que Prisma ne sait pas représenter l'index partiel. Passer à un index ordinaire est un choix séparé.
