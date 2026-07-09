# 05 — LEGAL GLOSSARY

> **Statut** : interne · v2026-07-09  
> Usage : aligner Legal, Product, Engineering, Support sur une terminologie unique.

---

## Commission

**Définition** : part du **prix fournisseur (wholesale)** versée à l’Affiliate Seller pour la vente d’un SKU, exprimée en **basis points (bps)** ou pourcentage du wholesale.

**Champs** : `Product.commissionRate`, `Order.commissionCents`, `AffiliateProduct` economics.

**Ne pas confondre avec** : marge (markup), frais plateforme Affisell.

**Exemple** : wholesale 100 €, commission 15 % → 15 € au affilié (avant frais plateforme affilié).

---

## Marge (Markup)

**Définition** : différence entre le **prix public** payé par l’acheteur (HT hors TVA) et le coût revendeur (wholesale + commission structure selon modèle listing).

**Champs** : `AffiliateProduct.marginCents`, `Order.marginCents`, `affiliateMarginRetainedCents`.

**Plafond Affisell** : markup max **300 %** du wholesale (décision Blueprint 2026-07-09).

**Alerte code** : `marginReviewNeeded` quand wholesale supplier change.

---

## Transfer (Stripe Connect Transfer)

**Définition** : mouvement de fonds du compte plateforme Stripe vers le compte Connect d’un marchand (Supplier ou Affiliate).

**Moment** : après `payoutEligibleAt`, via job transfers.

**Champs** : `Order.payoutTransferIds`, `payoutStatus`.

---

## Reversal (Transfer Reversal)

**Définition** : annulation partielle ou totale d’un Transfer Connect, typiquement déclenchée par un **remboursement buyer**.

**Objet technique** : `OrderStripeTransferReversal`, lié à `stripeRefundId`.

**Effet** : ramène les fonds du marchand vers la plateforme pour couvrir le refund.

---

## Clawback

**Définition** : recouvrement par Affisell d’une somme due par un marchand après remboursement, quand le Reversal est impossible ou insuffisant.

**Statut Order** : `REFUND_PENDING_CLAWBACK`.

**Ledger** : `MerchantPayoutLedger` entrées `CLAWBACK`.

**Responsabilité économique finale** : marchand débiteur, pas Affisell (sauf décision exceptionnelle CEO).

---

## Payout

**Définition** : versement effectif au marchand (Supplier ou Affiliate) = Transfer Connect réussi + statut settled.

**Éligibilité** : `payoutEligibleAt` = confirmation livraison + 7 jours (voir `04_MONEY_FLOW.md`).

**Disclaimer UI** : `PayoutPolicyDisclaimer` — délais, clawback, retours.

---

## Escrow

**Définition juridique retenue** : période entre **paiement buyer** et **Transfer Connect marchand** pendant laquelle les fonds sont en **custody Stripe**, soumis aux règles de remboursement / litige.

Affisell **n’opère pas** un escrow séparé hors Stripe en V1.

**Fenêtre critique** : entre T0 et T5 (voir money flow).

---

## DAC7

**Définition** : directive UE 2021/514 — reporting fiscal des revenus perçus par vendeurs via plateformes.

**Seuils disclosure Affisell** : 2 000 € **ou** 30 transactions / an (référence interne).

**Export** : `/api/affiliate/dac7-export` (CSV recap affilié).

**Obligés** : Affisell déclare ; marchands fournissent données exactes.

---

## KYC (Know Your Customer)

**Définition** : vérification d’identité **personne** (marchand individuel, représentant).

**Implémentation** : `MerchantLegalProfile` + documents `IDENTITY_*`.

**Blocage** : publication catalogue supplier sans KYC approuvé.

---

## KYB (Know Your Business)

**Définition** : vérification **entité juridique** (société, association, auto-entrepreneur).

**Implémentation** : statuts `COMPANY`, `AUTO_ENTREPRENEUR`, docs `KBIS_OR_INSEE`, `VAT_CERTIFICATE`, etc.

**Champs** : `siret`, `vatNumber`, `legalEntityName`.

---

## Termes connexes (court)

| Terme | Définition |
|-------|------------|
| **bps** | Basis points ; 100 bps = 1 % |
| **Wholesale** | Prix fournisseur (`supplierPriceCents`) |
| **CGU** | Conditions générales d’utilisation plateforme |
| **CGV** | Conditions générales de vente (buyer) |
| **CGA / CGS** | Conditions fournisseur / affilié |
| **MAP** | Minimum Advertised Price (futur) |
| **Connect** | Stripe Connect (comptes marchands) |
| **Chargeback** | Contestation carte par buyer via banque |

---

*Référence croisée : `01_LEGAL_BLUEPRINT.md`, `04_MONEY_FLOW.md`*
