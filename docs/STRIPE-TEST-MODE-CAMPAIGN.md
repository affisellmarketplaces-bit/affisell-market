# Campagne Stripe Test Mode — sécurité des virements (préparée le 2026-11-27, NON exécutée)

Objet : prouver en conditions Stripe réelles (mode test, sans argent) ce que la CI prouve avec des simulations : un
volet (commande × rôle) est payé au plus une fois, jamais pendant un litige ouvert ni après un remboursement total, et
toujours pour le montant exact `payableAfterRefunds`. Code de référence : `main` `8b2488846` (#13, #26, #28).

**Statut : préparée, rien n'a été exécuté.** Aucun résultat ci-dessous n'est une preuve tant que la colonne « Résultat »
n'est pas remplie à partir d'une exécution réelle, avec l'identifiant Stripe (`ch_`, `re_`, `dp_`, `tr_`) en preuve.

## 0. Préconditions (toutes obligatoires)

| # | Condition | Vérification |
|---|---|---|
| P1 | Déploiement **Preview** de `main` (jamais Production) | statut Vercel du commit |
| P2 | La Preview pointe sur la **base staging** (`ep-shy-wind-…`) — le build refuse sinon | `scripts/vercel-build.mjs` |
| P3 | Clés Stripe **test** sur l'environnement Preview (`sk_test_…`, `whsec_…` de l'endpoint de test) | `npm run verify:stripe-webhooks` affiche « key mode: test » |
| P4 | Endpoint webhook de test vers l'URL Preview, abonné aux 13 événements requis | `STRIPE_SECRET_KEY=sk_test_… npm run verify:stripe-webhooks -- --url-contains <hôte preview>` → exit 0 |
| P5 | `LIGHTNING_PAYOUTS_MODE` absent ou ≠ `enabled` sur Preview | variables Vercel Preview |
| P6 | Comptes Connect de test (fournisseur, revendeur) avec `transfers: active` | Dashboard test → Connect |
| P7 | Les workflows planifiés visent la **production**, pas la Preview : lancer le job à la main sur la Preview (`/api/jobs/process-transfers` avec le `CRON_SECRET` de Preview) | journal de chaque scénario |

## 1. Scénarios

Cartes de test Stripe : `4242 4242 4242 4242` (paiement normal), `4000 0000 0000 0259` (paiement puis **litige**
« fraudulent » ouvert automatiquement). Issue d'un litige de test : preuve `winning_evidence` → gagné, `losing_evidence`
→ perdu. Remboursements : Dashboard test ou `stripe refunds create --charge ch_…`.

| ID | Scénario | Attendu (garde-fou en cause) | Résultat |
|---|---|---|---|
| S1 | Paiement normal, commande livrée, job lancé 2× | 1 virement par rôle, montant = part prévue ; 2e passage : rien (`already_settled`, idempotence) | — |
| S2 | Remboursement partiel AVANT le job | virement = `payableAfterRefunds` (part − part proportionnelle du remboursement) | — |
| S3 | Remboursement total AVANT le job | aucun virement ; tentative `ORDER_REFUNDED` / `REFUNDED_SHARE` | — |
| S4 | Remboursement PENDANT le job (entre relecture et création — pause manuelle) | contrôle Stripe voit le remboursement → retenue `STRIPE_CHECK_*`, ou récupération après coup `clawBackRefundsDuringTransfer` | — |
| S5 | Carte `…0259` : litige ouvert avant le job | aucun virement (retenue litige D7 + contrôle `disputes.list`) | — |
| S6 | S5 puis litige **gagné** | le job suivant libère le virement, montant intact | — |
| S7 | S5 puis litige **perdu** | aucun virement ; ligne synthétique `${dp}:${order}` ; rien n'est payé à tort | — |
| S8 | Litige ouvert APRÈS le virement, puis perdu | reprise sur les parts déjà versées (D7 `dispute_lost`) ; aucune double reprise | — |
| S9 | Webhook rejoué (Dashboard → « Resend ») pour `charge.dispute.created` et `charge.refunded` | aucun effet double (ledger `ProcessedWebhook`, D2) | — |
| S10 | Événements dans le désordre : `closed` reçu avant `created` (rejouer `created` après) | un litige clos n'est jamais rouvert | — |
| S11 | Deux jobs simultanés sur la même tentative | un seul gagne le verrou de 5 min ; un seul `transfers.create` | — |
| S12 | Réponse Stripe perdue (couper le réseau du job après l'appel, ou timeout forcé) | le passage suivant adopte le virement existant via `transfers.list`, ne recrée rien | — |
| S13 | Webhook endpoint désabonné de `charge.dispute.*` puis litige ouvert | le contrôle de libération retient quand même (dernière ligne de défense) ; `verify:stripe-webhooks` → exit 2 | — |
| S14 | Lightning : tentative de déclenchement avec `LIGHTNING_PAYOUTS_MODE` absent | refus, aucun virement | — |

## 2. Preuve à conserver par scénario

- identifiants Stripe (`pi_`, `ch_`, `re_`, `dp_`, `tr_`), horodatage, commit de la Preview ;
- lecture SQL (staging, lecture seule) : `TransferAttempt` (statut, `amountCents`, `errorCode`), `MerchantPayoutLedger`
  (`stripeTransferId` unique), `OrderStripeRefund`, `ProcessedWebhook` (`dispute:%`) de la commande ;
- somme des virements Stripe du `transfer_group` = somme du ledger = part attendue (au centime).

## 3. Ce que la campagne ne couvre pas

- comportement en **mode live** (frais réels, délais bancaires, réserves Stripe) ;
- fenêtre de quelques millisecondes entre le contrôle Stripe et `transfers.create` (rattrapée après coup par S8) ;
- litige manqué au-delà de la fenêtre de réessai des webhooks Stripe (3 jours) APRÈS le virement : seule une
  réconciliation planifiée le rattraperait — elle n'existe pas encore pour les litiges (voir proposition ci-dessous).

## 4. Proposition (non développée) — réconciliation planifiée des litiges

Tâche en lecture Stripe (`disputes.list({ created: { gte: J-120 } })`, toutes les pages) qui compare chaque litige au
ledger `ProcessedWebhook` et rejoue le traitement D7 (idempotent, sous `lockDisputeHold`) pour tout litige absent ou en
retard. Ferme le dernier trou ci-dessus sans dépendre de la livraison des webhooks.
