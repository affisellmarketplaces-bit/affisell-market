# Libération d'un virement : litiges (D7) et vérification Stripe

Statut (2026-11-26) : **développé et testé localement** (mocks + PostgreSQL 16 jetable). **Non fusionné, non déployé,
jamais exécuté contre Stripe** (ni en mode test, ni en mode réel). Les virements restent arrêtés. Aucune migration.

## 1. Une seule vérité par montant

| Montant | Source de vérité | Où |
| --- | --- | --- |
| Part prévue de chaque bénéficiaire | `TransferAttempt.amountCents`, figée par la planification | `schedule-from-checkout.ts` |
| Argent rendu à l'acheteur | **Stripe** (`refunds.list({ charge })`), recopié dans `OrderStripeRefund` par le webhook | webhook `charge.refunded` |
| Litige | **Stripe** (`charge.disputed`, `Dispute.status`), recopié dans le registre `ProcessedWebhook` `dispute:<dp>:<order>` | `lib/stripe-dispute.ts` |
| Montant encore dû | **une seule règle**, `payableAfterRefunds` (#26), calculée sur les lignes locales **une fois vérifiées auprès de Stripe** | `lib/transfers/payable-after-refunds.ts` |
| Argent réellement versé | `MerchantPayoutLedger` (montant du virement, unique par `stripeTransferId`) | `recordStripePayoutSettlement` |
| Argent repris | reversals Connect + ligne `CLAWBACK` du registre | `order-payout.ts`, `stripe-transfer-reversal.ts` |

La vérification Stripe **ne calcule rien** : elle autorise ou retient un virement. Si Stripe et nos lignes concordent, le
montant versé est celui de `payableAfterRefunds`, la même règle que la reprise d'un virement déjà payé.

## 2. Cycle de vie d'un litige (D7, porté de `release/finalisation-2026-11-13`, commits `eb6ac58fa` et `7c9c92b30`)

Les événements `charge.dispute.created | updated | closed | funds_withdrawn | funds_reinstated` sont traités selon **le
statut du litige**, pas selon le nom de l'événement : Stripe ne garantit pas l'ordre de livraison.

| Statut Stripe | État Affisell | Effet |
| --- | --- | --- |
| `needs_response`, `under_review`, `warning_needs_response`, `warning_under_review`, **inconnu** | **OUVERT** | Commande `disputed` et ligne `dispute_open` dans le registre. **Tout versement est retenu** : Connect, Lightning et Légion. La tentative reste `PENDING`, sans essai consommé. Rien n'est repris tant que la banque n'a pas tranché. |
| `won`, `warning_closed`, `prevented` | **CLOS SANS PERTE** | Le statut précédent est restauré à l'identique, la ligne passe à l'état final et la retenue est levée. |
| `lost` | **PERDU** | Appliqué automatiquement **uniquement** si le montant du litige est égal au total facturé des commandes du paiement, dans la même devise. Il passe alors par les mécanismes de remboursement existants : reprise des virements (jamais plus que ce qui a été viré), ligne `OrderStripeRefund` `dp_…:order`, reprise dans le registre, état `REFUNDED` ou `REFUND_PENDING_CLAWBACK`. Sinon (litige partiel, commande **partiellement remboursée**, autre devise, commande introuvable) : la retenue reste et une personne est alertée. |

Garanties :
- **La décision repose sur l'état Stripe faisant autorité** : le litige est relu avec `disputes.retrieve` à chaque
  événement, et l'instantané de l'événement n'est jamais utilisé pour décider. Un `closed` « perdu » retardé, alors que
  le litige est encore ouvert chez Stripe, ne déplace aucun argent. Si Stripe est illisible, l'événement échoue et il est
  rejoué (D2) ; rien n'est modifié entre-temps.
- **Une seule décision par (litige, commande)** : `lockDisputeHold` crée la ligne si elle manque, puis effectue une
  écriture sans effet qui pose le verrou de ligne jusqu'à la fin de la transaction du webhook. Un événement concurrent du
  même litige attend, puis relit l'état validé. Sur PostgreSQL 16, la lecture simple d'avant laissait `won` et `lost`
  agir tous les deux, avec des effets contradictoires ; avec le verrou, un seul agit et le statut final est le sien.
- Une ligne finale n'est jamais rouverte ni réécrite.
- Un `created` arrivé après un `closed` ne change rien.
- Les effets sont écrits d'abord et la ligne finale en dernier : un rejeu après un échec à mi-chemin converge.
- **Un événement de litige ou de remboursement qui a échoué est rejoué** quand Stripe le renvoie (D2, commit `88daf8e9f`).
  Sur `main`, toute ligne déjà enregistrée était traitée comme un doublon, même en échec : le litige n'était alors jamais
  enregistré.

Lien sans ambiguïté :
- litige → `dispute.charge` = `Order.stripeChargeId` (unique) ;
- ou `dispute.payment_intent` = `Order.stripePaymentIntentId` (unique) ;
- ou la Checkout Session du PaymentIntent, puis toutes ses lignes `${session}:line:N`.

## 3. Vérification directe auprès de Stripe à la libération

`lib/transfers/stripe-release-check{,.server}.ts`, appelée par `process-transfers.ts` juste avant `transfers.create`.

1. **Paiement :** `Order.stripeChargeId`, sinon `paymentIntents.retrieve(stripePaymentIntentId).latest_charge`, puis
   `charges.retrieve`.
2. **Remboursements :** `refunds.list({ charge })`, en parcourant toutes les pages (plus de 100 : retenue).
   `Charge.refunds` n'est pas renvoyé par défaut sur l'API `2026-04-22.dahlia` (SDK 22.1.1, vérifié dans ses typages) :
   on ne s'y fie jamais.
3. **Décision**, tout écart entraînant une **retenue** (`errorCode` `STRIPE_CHECK_*` sur la tentative, journal
   `transfer_held_stripe_check`) :
   - paiement non `succeeded` ou non capturé ; devise différente de celle de la commande ;
   - **litige** : `Charge.disputed` signifie seulement que le paiement *a été* contesté, et un litige gagné le laisse
     positionné. Les litiges eux-mêmes (`disputes.list({ charge })`, toutes pages) décident par leur statut réel :
     ouvert ou inconnu → retenue ; perdu → retenue (`dispute_lost_not_applied`, car D7 aurait clos la commande) ; gagné
     ou clos sans perte → le virement peut partir. Un paiement signalé contesté sans aucun litige listé → retenue ;
   - remboursement `succeeded`, `pending`, `requires_action` ou de statut inconnu absent de nos lignes, ou d'un montant
     différent ; les statuts `failed` et `canceled` ne comptent pas comme remboursements ;
   - ligne locale qui ne correspond à aucun remboursement en cours chez Stripe ;
   - paiement couvrant plusieurs commandes et remboursement qui ne désigne aucune commande ;
   - Stripe injoignable.
   Les lignes de litige perdu écrites par D7 (`dp_…:order`) ne sont pas comparées : ce ne sont pas des remboursements
   Stripe.
4. **Traçabilité :** le virement porte `scheduledCents`, `refundShareCents` et `stripeCheckedRefundCents` dans ses
   métadonnées. Le registre comptable enregistre le montant réellement versé.

**TVA, livraison, arrondi :** les remboursements Stripe sont TTC. Ils sont rapportés au total facturé
(`orderChargedTotalCents`, TTC), avec la même fonction et le même arrondi que la reprise. La livraison est incluse dans le
prix et n'est jamais facturée séparément (voir `AGENTS.md`). La devise est comparée.

## 4. Concurrence

| Course | Protection | Preuve |
| --- | --- | --- |
| Deux exécutions de la même tentative (cron + webhook) | **Bail** : `UPDATE … SET lastAttemptAt = NOW() WHERE status = 'PENDING' AND (lastAttemptAt IS NULL OR < NOW() - 5 min)` ; seule l'exécution dont la mise à jour aboutit continue | PostgreSQL 16 : 20 réservations simultanées → 1 gagnante ; bail expiré → de nouveau réservable ; `SUCCESS` jamais réservée |
| Une exécution plus longue que le bail | Chaque appel Stripe peut durer environ 240 s (SDK : 80 s de délai, 2 nouvelles tentatives), soit plusieurs fois 5 minutes au total. **Clôture** juste avant `transfers.create` : le bail n'est renouvelé que s'il est encore celui de cette exécution (`lastAttemptAt = leaseNow`) ; sinon elle s'arrête sans rien créer. Le bail renouvelé couvre l'appel de création lui-même | PostgreSQL 16 : le worker 2 reprend le bail expiré ; le renouvellement du worker 1 est refusé |
| Un échec qui écraserait un `SUCCESS` | L'écriture d'échec ne touche qu'une tentative encore `PENDING` | test unitaire |
| Deux livraisons d'un litige | Identifiant unique de la ligne `dispute:<dp>:<order>` | 20 ouvertures simultanées → 1 ligne |
| `won` et `lost` en concurrence | Fermeture conditionnelle `WHERE status = 'dispute_open'` | une seule fermeture appliquée ; un `created` tardif ne rouvre rien |
| Double enregistrement d'un même virement | `MerchantPayoutLedger.stripeTransferId` unique, clé d'idempotence `transfer_{order}_{role}` | contrainte du schéma |

Script : `scripts/sql/test-release-concurrency.sh` (refuse toute base non locale).

**Hypothèses non démontrées ici.** Elles sont documentées par Stripe et le SDK, mais aucun test ne les exerce contre
Stripe :
- deux `transfers.create` portant la même clé d'idempotence ne créent qu'un seul virement pendant environ 24 h ;
- une requête concurrente avec la même clé est refusée ;
- `transfers.list` montre un virement créé avant un plantage. La reprise d'un virement existant en dépend après
  l'expiration de la clé.

**Fenêtre non fermée par l'architecture actuelle.** Entre la vérification Stripe et `transfers.create`, il s'écoule
quelques millisecondes. Un remboursement créé chez Stripe dans cet intervalle n'est pas vu. Le contrôle qui suit le
virement le reprend dès que son webhook est enregistré, mais **si le serveur plante juste après l'appel**, ce contrôle n'a
pas lieu. Seul le **registre de virements (#12)** ferme ce cas : un volet `PROCESSING` sous bail, une recherche Stripe
avant toute création, l'état `IN_DOUBT` sans nouvel essai automatique, puis la réconciliation. C'est la protection
nécessaire, à reprendre après cette PR.

## 5. Hors périmètre, explicitement

- **Lightning** (paiement instantané) : retenu pendant un litige et refusé sur une commande close, mais **sans la
  vérification Stripe**. Il reste verrouillé par #13 jusqu'au registre #12.
- **Commission Légion** : même situation (retenue pendant un litige et commande close refusée, sans vérification Stripe).
- **Frais de litige Stripe** : attribués à personne (alerte).
- **Rejeu tardif** des événements au-delà de la fenêtre de nouvel essai de Stripe : non porté (cron `replay-failed-*`
  de la ligne parallèle).
