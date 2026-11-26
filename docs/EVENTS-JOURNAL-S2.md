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

## Activation (fondateur, après les fusions)

1. Vérifier que la migration `event_spine` est appliquée en production : `npm run schema:verify` (`docs/DEPLOY-SCHEMA-CHANGES.md`). **Aucune migration n'est ajoutée par S2.**
2. Faire une reconstruction à blanc, qui ne fait que compter, en lecture seule :
   `npx tsx --conditions=react-server scripts/events-journal-backfill.ts --since 2026-01-01`
3. Reconstruire l'historique :
   `EVENTS_JOURNAL=on AFFISELL_ALLOW_PRODUCTION_WRITES=<endpoint> npx tsx --conditions=react-server scripts/events-journal-backfill.ts --since 2026-01-01 --apply`
4. Ajouter `EVENTS_JOURNAL=on` dans Vercel (Production), puis programmer `/api/cron/events-journal` toutes les heures (GitHub Actions, comme les autres crons, avec `CRON_SECRET`).
5. **Retour arrière** : retirer `EVENTS_JOURNAL`. Les écritures s'arrêtent et la garde de marge revient au taux par défaut ; les événements déjà écrits restent, identifiables par `source = journal_projection`.

## Étapes suivantes

- **S3** : endpoint navigateur pour les événements de comportement, soumis au consentement (`lib/events/schema.ts` est prêt).
- **S4–S6** : attribution, `OrderAttribution`, recommandations et pilote automatique revendeur.
