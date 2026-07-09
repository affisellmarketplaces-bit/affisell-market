# 03 — RESPONSIBILITY MATRIX

> **Statut** : interne · v2026-07-09  
> **Légende** : **P** = primaire · **S** = secondaire · **A** = Affisell exécute · **—** = non applicable

---

## Modération & catalogue

| Action | Responsable (P) | Secondaire (S) | Délai cible | Notes |
|--------|-----------------|----------------|-------------|-------|
| Exactitude fiche produit (description, prix wholesale) | Supplier | Affisell (modération) | Avant publish | KYC requis |
| Publication listing affilié | Affiliate Seller | Supplier (catalogue source) | — | Validation marge / prix |
| Retrait listing non conforme | Affisell (A) | Supplier / Affiliate (demande) | **24 h** | Signalement |
| Retrait produit dangereux | Supplier | Affisell (A) | **24 h** | Stop vente immédiat si urgence |
| Blocage compte marchand | Affisell | — | **24–72 h** | Selon gravité |
| Contrefaçon / IP | Supplier (garantie) | Affisell (takedown) | **48 h** | Notice formelle |

---

## Prix & promotions

| Action | Responsable (P) | Secondaire (S) | Délai cible | Notes |
|--------|-----------------|----------------|-------------|-------|
| Fixation prix public | Affiliate Seller | — | — | Sous plafond 300 % markup |
| Fixation wholesale | Supplier | — | — | |
| Détection prix abusif | Affisell (monitoring) | Customer (signalement) | **48 h** review | |
| Sanction prix abusif | Affisell | Affiliate Seller | **24 h** retrait | |
| Cashback / reward acheteur | Affiliate Seller (finance) | — | — | Depuis marge |
| Coupon campagne plateforme | Affisell (finance) | — | — | Future feature |

---

## Commande & livraison

| Action | Responsable (P) | Secondaire (S) | Délai cible | Notes |
|--------|-----------------|----------------|-------------|-------|
| Préparation & expédition | Supplier | — | SLA fiche / CGV | Tracking requis |
| Confirmation livraison | Customer | Affisell (auto-confirm) | +10 j post-livraison | `AUTO_CONFIRM_DAYS` |
| Litige non-réception | Supplier | Affisell (support) | **5 j ouvrés** réponse | |

---

## Paiements & commissions

| Action | Responsable (P) | Secondaire (S) | Délai cible | Notes |
|--------|-----------------|----------------|-------------|-------|
| Encaissement buyer | Stripe | Affisell (orchestration) | T0 checkout | |
| Calcul TVA | Stripe Tax | Affisell (sync order) | T0 | `taxCents` |
| Éligibilité payout marchand | Affisell (système) | — | J+7 post-confirm | `payoutEligibleAt` |
| Transfert Connect Supplier | Affisell (job) | Stripe | Après éligibilité | |
| Transfert Connect Affiliate | Affisell (job) | Stripe | Après éligibilité | |
| Prélèvement frais plateforme | Affisell | — | Au split | bps Phase 1 |

---

## Remboursements & litiges

| Action | Responsable (P) | Secondaire (S) | Délai cible | Notes |
|--------|-----------------|----------------|-------------|-------|
| Instruction remboursement (légal) | Affisell (facilitation) | Supplier | Selon CGV | Buyer toujours protégé |
| Remboursement Stripe buyer | Affisell (A) | — | **5–10 j** | |
| Transfer reversal Connect | Affisell (A) | Stripe | Immédiat post-refund | |
| Échec reversal (`REFUND_PENDING_CLAWBACK`) | Marchand débiteur (P) | Affisell (recouvrement) | **30 j** plan recouvrement | Avance buyer si requis |
| Chargeback carte | Affisell (gestion) | Marchand (fonds) | Selon réseau | |
| Retour produit (RMA) | Supplier (décision) | Affiliate (support L1) | **48 h** décision | `OrderReturn` |

---

## Conformité & données

| Action | Responsable (P) | Secondaire (S) | Délai cible | Notes |
|--------|-----------------|----------------|-------------|-------|
| KYC dossier marchand | Supplier / Affiliate (fourniture) | Affisell (review) | **5 j ouvrés** review | `MerchantLegalProfile` |
| Export données RGPD | Affisell (A) | — | **30 j** max légal | `/api/gdpr/export` |
| Suppression compte | Affisell (A) | — | **30 j** | Rétention commandes |
| Consentement cookies | Customer (choix) | Affisell (banner) | Immédiat | |
| Réacceptation CGS/CGA | Merchant (acceptation) | Affisell (gate) | Bloquant | `reaccept-terms` |
| Reporting DAC7 | Affisell (déclaration) | Merchant (données) | Annuel | Seuils 2000€ / 30 tx |

---

## Sécurité produit & autorités

| Action | Responsable (P) | Secondaire (S) | Délai cible | Notes |
|--------|-----------------|----------------|-------------|-------|
| Rappel produit (safety recall) | Supplier | Affisell (diffusion) | **24 h** | |
| Information acheteurs exposés | Supplier (contenu) | Affisell (envoi) | **72 h** | |
| Signalement autorité (RAPEX, etc.) | Supplier | Affisell (coopération) | **24–48 h** | Obligation légale selon cas |
| Conservation preuves | Affisell | Supplier | 5 ans | Logs + `TermsAcceptanceLog` |

---

## Support & gouvernance

| Action | Responsable (P) | Secondaire (S) | Délai cible | Notes |
|--------|-----------------|----------------|-------------|-------|
| Support buyer L1 | Affisell | Affiliate (vitrine) | **48 h** | |
| Support marchand | Affisell | — | **72 h** | |
| Escalade Legal | Affisell Legal | CEO | Immédiat si risque pénal | |
| Mise à jour contrat public | Legal | Product + Eng | Roadmap | Versioning LMS |

---

## Matrice RACI simplifiée (extrait)

|  | Supplier | Affiliate | Affisell | Customer |
|--|----------|-----------|----------|----------|
| Produit conforme | **R/A** | I | C | — |
| Prix public | C | **R/A** | C | I |
| Expédition | **R/A** | I | C | I |
| Remboursement dû | C | C | **R** (exécution) | **I** (demande) |
| KYC | **R** (docs) | **R** | **A** (review) | — |

*R = Responsible · A = Accountable · C = Consulted · I = Informed*

---

*Référence : `01_LEGAL_BLUEPRINT.md` Q3, Q7, Q8*
