# 04 — MONEY FLOW

> **Statut** : interne · v2026-07-09  
> **Modèle** : Stripe Connect · 1 Order = 1 produit · Phase 1 fees

---

## 1. Schéma global

```
┌──────────┐    paiement     ┌─────────────┐    orchestration    ┌──────────────┐
│ CUSTOMER │ ──────────────► │   STRIPE    │ ◄────────────────── │   AFFISELL   │
│ (Buyer)  │   TTC checkout  │  (custody)  │   webhooks + jobs   │  (plateforme)│
└──────────┘                 └──────┬──────┘                     └──────┬───────┘
                                    │                                      │
                    ┌───────────────┼───────────────┐                      │
                    ▼               ▼               ▼                      │
              ┌──────────┐   ┌────────────┐   ┌─────────────┐               │
              │ SUPPLIER │   │  AFFILIATE │   │  AFFISELL   │               │
              │ Connect  │   │  Connect   │   │  fees net   │               │
              └──────────┘   └────────────┘   └─────────────┘               │
```

**Custody** : les fonds sont détenus par **Stripe** jusqu’aux transferts Connect. Affisell ne détient pas de compte bancaire marchand hors Stripe.

---

## 2. Décomposition d’une commande (logique)

Pour une vente marketplace standard :

| Composante | Champ Order (indicatif) | Bénéficiaire économique |
|------------|----------------------|-------------------------|
| Prix ligne HT | `subtotalCents` | Base de calcul |
| TVA | `taxCents` | État (via Stripe Tax) |
| Total TTC payé | `totalCents` | — |
| Commission affilié (part supplier) | `commissionCents` | Affiliate |
| Marge affilié (markup) | `marginCents` / `affiliateMarginRetainedCents` | Affiliate |
| Payout supplier net | `supplierPayoutCents` | Supplier |
| Frais plateforme Affisell | `affisellFeeCents` (+ split supplier/affiliate fees) | Affisell |

Références : `lib/marketplace-phase1-fees.ts`, `lib/order-commission-breakdown.ts`.

---

## 3. Frais plateforme Affisell (Phase 1 — défauts)

| Fee | BPS défaut | Assiette | Payeur |
|-----|------------|----------|--------|
| Supplier catalog | 1000 (10 %) | Wholesale supplier | Supplier (retenu au payout) |
| Supplier auto-buy | 1700 (17 %) | Wholesale AE | Supplier |
| Affiliate platform | 2000 (20 %) | Gains affilié (commission + markup) | Affiliate |

Overrides : `User.supplierFeeBps*`, `User.affiliatePlatformFeeBps`, catégorie produit.

---

## 4. Timeline — naissance du droit au paiement

```
T0   checkout.session.completed     → Order.status = paid
     │                                Fonds capturés Stripe
T1   supplier ships                  → shippedAt
T2   carrier delivered              → deliveredAt
T3   buyer confirms OR auto         → deliveryConfirmedAt
     │   (auto at delivered + 10d)    deliveryConfirmedBy = buyer | auto_no_response
T4   payoutEligibleAt               → deliveredConfirmed + 7 jours
T5   transfer job                    → Connect Transfer Supplier + Affiliate
T6   settled                         → payoutStatus updated
```

**Constantes code** :

- `PAYOUT_DAYS_AFTER_DELIVERY_CONFIRM = 7`
- `AUTO_CONFIRM_DAYS_AFTER_DELIVERY = 10`

---

## 5. Droit au paiement par acteur

### 5.1 Supplier

**Droit au payout** : `supplierPayoutCents` net, **à T4** (`payoutEligibleAt`), si :

- commande non remboursée intégralement ;
- pas de litige ouvert bloquant ;
- compte Connect valide ;
- KYC approuvé (si enforcement actif).

**Formule** (simplifiée) :

```
supplierPayoutCents = supplierPriceCents - affiliateCommissionCents - supplierFeeCents
```

(voir `netSupplierPayoutCents`)

### 5.2 Affiliate Seller

**Droit au payout** : commission + marge nette, **à T4**, si mêmes conditions.

**Formule** (simplifiée) :

```
netAffiliate = netAffiliateTransferCents(commission, marginRetained, affiliateFeeCents, ...)
```

Platform fee 20 % sur earnings affilié (Phase 1).

### 5.3 Affisell

**Droit aux frais plateforme** : acquis à **T4** (même assiette que payouts), reconnus en comptabilité Affisell.

**Pas de droit** aux montants destinés aux marchands au-delà des fees contractuels.

---

## 6. Flux remboursement & clawback

```
Refund buyer (Stripe) ──► Transfer Reversal(s) vers Supplier / Affiliate Connect
                              │
                              ├─ OK → ledger équilibré
                              └─ FAIL → Order REFUND_PENDING_CLAWBACK
                                         → créance marchand sur Affisell
                                         → suspension payouts / recouvrement
```

**Priorité économique** :

1. Reversal fonds Connect encore disponibles ;
2. Compensation sur ventes futures ;
3. Créance formelle Affisell vs marchand.

**Avance buyer** : Affisell peut rembourser avant recouvrement complet (obligation légal consommateur).

---

## 7. Promotions & cashback

| Mécanisme | Flux |
|-----------|------|
| Cashback buyer (`buyerRewardCents`) | Réduit marge affilié **avant** split |
| Coupon affilié (baisse prix) | Réduit `sellingPriceCents`, impacte marge affilié |
| Coupon Affisell (futur) | Charge compte marketing Affisell |

---

## 8. TVA

- Collectée au checkout (Stripe Tax) ;
- `Order.taxCents`, `taxCountry`, `taxRate` ;
- Affisell fee calculée sur **HT**, pas sur TVA (`stripe-sync-order-vat-from-session`).

---

## 9. États Order critiques (référence)

| Statut | Effet payout |
|--------|--------------|
| `paid` | En attente livraison |
| `shipped` / `delivered` | Horloge confirmation |
| `REFUNDED` / `PARTIALLY_REFUNDED` | Payout réduit / annulé |
| `REFUND_PENDING_CLAWBACK` | Payout bloqué côté marchand |

---

## 10. Gaps code → implémentation

| Gap | Impact money flow |
|-----|-------------------|
| Pas de `discountFundedBy` | Impossible d’attribuer promos en ledger |
| Plafond markup 300 % non enforced | Risque prix aberrants pré-payout |
| CGV non liée à Order | Preuve contractuelle vente incomplète |

---

*Référence : `01_LEGAL_BLUEPRINT.md` Q4–Q7, `05_LEGAL_GLOSSARY.md`*
