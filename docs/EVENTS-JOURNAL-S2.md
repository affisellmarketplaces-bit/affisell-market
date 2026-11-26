# Journal d'événements — étape S2 : le journal métier

## Ce que fait S2

S2 dérive les faits métier des tables qui les contiennent déjà, et les écrit dans `AffisellTrackEvent` (classe *transactional*) :

| Source | Événement | Clé (idempotence) |
|---|---|---|
| `Order` dont `paidAt` est renseigné (paiement réussi) | `purchase` | `purchase:{orderId}` |
| `OrderStripeRefund` | `refund` | `refund:{stripeRefundId}` |
| `OrderReturn` | `return_requested` | `return_requested:{returnId}` |
| `OrderReturn` à l'état final | `return_resolved` | `return_resolved:{returnId}` |
| `Order.deliveredAt` | `delivery` | `delivery:{orderId}` |
| `Review` publiée | `review_created` | `review_created:{reviewId}` |
| `AffiliateProduct` | `creator_product_added` | `creator_product_added:{listingId}` |

Fichiers : `lib/events/journal-mapping.ts` (correspondances pures), `lib/events/journal-projector.server.ts`, `lib/cron/events-journal.ts`, route `/api/cron/events-journal` (toutes les heures, avec une fenêtre de 3 jours qui se recouvre d'une exécution à l'autre, lecture paginée par 1 000 lignes avec un indicateur `truncated` au-delà de 500 000 lignes par source), `scripts/events-journal-backfill.ts`.

## Pourquoi une projection plutôt que des émetteurs dans le code des paiements

- **Rien n'est ajouté au circuit de l'argent** : ni latence, ni nouvelle cause d'échec dans une transaction de paiement.
- **Rejouable** : des clés déterministes et `skipDuplicates` font qu'une relance, une fenêtre qui se recouvre ou une reconstruction n'écrivent jamais deux fois le même événement.
- **Traçable** : chaque événement pointe vers la ligne d'origine (`orderId`, `stripeRefundId`…), et `source = journal_projection`.
- **Reconstruction de l'historique** : les taux de remboursement sont disponibles tout de suite, sans attendre des mois de collecte.
- Ce qui reste interdit vaut toujours : aucun identifiant visiteur, aucun canal marketing sur un fait métier (contrôlé par `buildEventRow` et par les contraintes CHECK de la base).

## Premier usage

`lib/events/journal-metrics.server.ts` calcule les taux de remboursement mesurés par produit, lissés vers 10 % pour les petits échantillons. Le rail d'opportunités les transmet à la garde de marge nette (`lib/reseller-margin-guard.ts`) : un produit souvent remboursé cesse d'être recommandé. Sans données, le taux par défaut s'applique ; aucune erreur n'est possible.

## Activation (fondateur, après les fusions) — procédure validée

Chaque étape produit une preuve à conserver (sortie de commande). On ne passe pas à l'étape suivante sans elle.
Les étapes 1, 2, 3, 5 et 7 sont **en lecture seule**.

| # | Étape | Commande | Preuve attendue |
| --- | --- | --- | --- |
| 1 | Structure S1 présente | `DATABASE_URL='<url prod>' npm run schema:verify` | code de sortie 0 (aucune migration ajoutée par S2) |
| 2 | Reconstruction à blanc | `npx tsx --conditions=react-server scripts/events-journal-backfill.ts --since 2026-01-01` | `rows` / `events` par source, `truncated: false` partout |
| 3 | État initial | `npx tsx --conditions=react-server scripts/events-journal-reconcile.ts --since 2026-01-01` | code 6 attendu (`missing` = tout, `orphans: 0`) |
| 4 | Reconstruction | `EVENTS_JOURNAL=on AFFISELL_ALLOW_PRODUCTION_WRITES=<endpoint> npx tsx --conditions=react-server scripts/events-journal-backfill.ts --since 2026-01-01 --apply` | `written` = `events` de l'étape 2 ; `error: null` |
| 5 | **Réconciliation** | même commande qu'à l'étape 3 | **code 0** : `missing: 0`, `orphans: 0`, `refundRates.maxAbsDiff: 0` |
| 6 | Idempotence | relancer l'étape 4 | `written: 0`, `duplicates` = `events` |
| 7 | Volume | si une source affiche `truncated: true` | relancer 4 puis 5 par fenêtres plus courtes (`--since … --until …`) |
| 8 | Activation | `EVENTS_JOURNAL=on` dans Vercel (Production), puis le cron horaire `/api/cron/events-journal` (GitHub Actions + `CRON_SECRET`, comme les autres crons) | le lendemain : étape 5 sur les dernières 48 h → code 0 |

**Reprise après interruption.** La projection est idempotente (`eventId` déterministe, `skipDuplicates`). Après
une coupure (réseau, timeout, déploiement), on relance la même fenêtre, puis la réconciliation. Le test
`events-journal-reconcile.test.ts` le démontre : une source qui échoue en cours de route est détectée
(`missing`, dérive des taux), et une relance la complète.

**Cohérence avec la garde de marge.** La réconciliation recalcule le taux de remboursement lissé de chaque produit,
une fois à partir du journal et une fois à partir des tables sources. Un écart (`refundRates.drifts`) signifie que
les recommandations liraient un taux faux. On ne passe pas à l'étape 8 tant qu'il en reste un.

**Pagination.** La pagination se fait par pages de 1 000 lignes, dans un ordre déterministe, et s'arrête à
500 000 lignes par source et par exécution. Au-delà, le résultat indique `truncated: true` et un message est
journalisé : on découpe alors la fenêtre. Une ligne modifiée pendant la lecture (retours, avis) peut être
manquée ; elle est rattrapée à l'exécution suivante, puisque le cron relit trois jours qui se chevauchent, et
la réconciliation la signale entre-temps.

**Retour arrière.** On retire `EVENTS_JOURNAL`, et deux choses se produisent :

- les écritures s'arrêtent ;
- la garde de marge et le copilote reviennent au taux par défaut **sans même lire les événements**.

Les événements déjà écrits restent dans la table. Ils sont identifiables par `source = journal_projection`.

## Étapes suivantes

- **S3** : endpoint navigateur pour les événements de comportement, soumis au consentement (`lib/events/schema.ts` est prêt).
- **S4–S6** : attribution, `OrderAttribution`, recommandations et pilote automatique revendeur.
