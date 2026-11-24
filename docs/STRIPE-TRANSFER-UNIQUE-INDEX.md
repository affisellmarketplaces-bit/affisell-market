# Suivi prioritaire : unicité de `MerchantPayoutLedger.stripeTransferId`

**Statut : anomalie maintenue, aucune correction pour l'instant** (décision du fondateur du 2026-11-24). Aucun index n'est créé, aucune donnée n'est modifiée, aucune base réelle n'est lue, aucune déduplication n'est faite.

## Faits établis

**Sur une base construite par la chaîne, en CI et en local, l'index existe et garantit l'unicité.**
- La migration publiée `20260705150000_payout_ledger_stripe_link` le crée ainsi :
  `CREATE UNIQUE INDEX IF NOT EXISTS "MerchantPayoutLedger_stripeTransferId_key" ON "MerchantPayoutLedger"("stripeTransferId") WHERE "stripeTransferId" IS NOT NULL`
- Dans PostgreSQL, un index unique ordinaire admet déjà plusieurs valeurs NULL. L'index partiel garantit donc la **même chose** que celui déclaré par Prisma (`stripeTransferId String? @unique`).

**Prisma ne représente pas un index partiel.** Son diff demande `CREATE UNIQUE INDEX` sous le même nom. Cet écart figure dans la baseline sous l'identifiant `stripe-transfer-unique-partial`. La CI rejette toute base où cet index manque ou diffère : c'est le test négatif `stripe_unique_removed`.

## Inconnu

On ne sait pas si l'index existe sur le **staging** et la **production**. Ces bases ont connu des `prisma db push` et une ancienne auto-réparation, et l'`IF NOT EXISTS` aurait sauté la création si un objet du même nom existait déjà. Aucune lecture n'a été faite.

## Risque si l'index est réellement absent

Le même virement Stripe pourrait être enregistré deux fois dans le registre des versements : double comptage d'un versement, rapprochement faux, risque de double paiement selon le chemin qui lit le registre. **Gravité : élevée.**

## Procédure de résolution (étapes séparées, chacune sur autorisation explicite)

1. **Lecture seule, staging puis production.**
   - Présence et définition de l'index :
     `SELECT indexdef FROM pg_indexes WHERE indexname = 'MerchantPayoutLedger_stripeTransferId_key';`
   - Doublons :
     `SELECT "stripeTransferId", count(*) FROM "MerchantPayoutLedger" WHERE "stripeTransferId" IS NOT NULL GROUP BY 1 HAVING count(*) > 1;`

   Sortie attendue : des comptes seulement, sans aucune donnée de partenaire.
2. **Si l'index existe** (ordinaire ou partiel) : rien à corriger, le risque est levé pour cette base.
3. **Si l'index manque et qu'il n'y a aucun doublon** :
   - migration protégée `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS …` ;
   - hors transaction, ce qui demande une migration dédiée, parce que `CONCURRENTLY` est incompatible avec la transaction de Prisma ;
   - staging d'abord.
4. **Si l'index manque et qu'il y a des doublons** : on s'arrête. Il faut une analyse de chaque doublon (versement réel ou ligne en double) et une décision financière avant toute déduplication. Aucune suppression automatique.
5. La baseline garde son entrée tant que Prisma ne sait pas représenter l'index partiel. Le passage éventuel à un index ordinaire est un choix séparé.
