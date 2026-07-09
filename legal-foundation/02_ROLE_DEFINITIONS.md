# 02 — ROLE DEFINITIONS (Définitions juridiques)

> **Statut** : référence interne Affisell · v2026-07-09  
> **Mapping technique** : `User.role` (string Prisma)

---

## AFFISELL (l’opérateur)

**Définition** : société exploitant la plateforme marketplace `affisell.com` et domaines associés.

**Qualification juridique** : opérateur de plateforme en ligne (intermédiaire), prestataire de services de paiement **via Stripe Connect** (Affisell n’est pas établissement de paiement).

**Pouvoirs** :

- Héberger catalogues et vitrines ;
- Modérer contenus et listings ;
- Prélever frais de service ;
- Suspendre comptes pour violation contrats / loi ;
- Transmettre données réglementaires (DAC7, etc.).

**Obligations** :

- Due diligence (KYC marchands, signalements) ;
- Sécurité paiements (PCI scope réduit via Stripe) ;
- RGPD (processor / controller selon traitement) ;
- Information consommateurs (mentions, CGV accessibles).

**Entité légale** : variables `{{COMPANY_NAME}}`, `{{SIREN}}`, etc. (`lib/legal/company-env.ts`).

---

## CUSTOMER (Acheteur)

**Rôle technique** : `User.role = "CUSTOMER"`

**Définition** : personne physique ou morale achetant un produit via la plateforme (marketplace, vitrine affiliée, ou checkout invité lié email).

**Sous-types** :

| Type | Champ | Effet |
|------|-------|-------|
| Particulier | `buyerAccountType = INDIVIDUAL` | Droit consommation EU |
| Professionnel | `buyerAccountType = PROFESSIONAL` | Facturation B2B, exclusions possibles |

**Contrats acceptés** : CGU (`/cgu`), Privacy (`/privacy`), CGV applicables à la commande (`/cgv`).

**Relation contractuelle** :

- Contrat de vente **avec le marchand identifié** sur la fiche (Supplier + canal Affiliate) ;
- Affisell = intermédiaire technique et agent de paiement orchestré.

**Droits** : RGPD (export/suppression `/dashboard/account/gdpr` ou `/marketplace/account/gdpr`), rétractation / garanties selon CGV et loi.

---

## SUPPLIER (Fournisseur)

**Rôle technique** : `User.role = "SUPPLIER"`

**Définition juridique** : professionnel qui propose des produits au catalogue Affisell, fixe le prix fournisseur (wholesale), expédie ou mandate l’expédition, et assume la conformité produit.

**Contrats acceptés** :

- CGU plateforme ;
- **CGA** — Conditions Générales Fournisseur (`/conditions-fournisseur`, slug `terms-supplier`) ;
- Privacy ;
- Conditions Stripe Connect.

**Obligations clés** :

- KYC / `MerchantLegalProfile` validé avant publication catalogue (enforcement `supplier-publish-blockers`) ;
- Exactitude des fiches produit ;
- Respect délais d’expédition ;
- Gestion SAV produit, retours selon policy ;
- Fiscalité (TVA, DAC7 si seuils).

**Pouvoirs** :

- Définir wholesale et taux commission affilié par défaut ;
- Inviter des affiliés (`SupplierAffiliateInvitation`) ;
- Accepter/refuser retours selon workflow `OrderReturn`.

**Stripe** : compte Connect Express/Standard (`User.stripeConnectAccountId`, `SupplierProfile`).

---

## AFFILIATE (Affiliate Seller / Revendeur affilié)

**Rôle technique** : `User.role = "AFFILIATE"`

**Définition juridique** : professionnel ou créateur qui **revend** des produits du catalogue via sa **vitrine** (`Store`), fixe le **prix public** dans les bornes Affisell, et touche une rémunération (commission + marge).

> **Terminologie UX** : toujours « Affiliate Seller » ou « Revendeur » côté produit — jamais confondre avec le rôle technique `AFFILIATE` seul.

**Contrats acceptés** :

- CGU ;
- **CGS** — Conditions Générales Affilié (`/conditions-affilie`, slug `terms-affiliate`) ;
- Privacy ;
- Stripe Connect (Lightning Payout).

**Obligations clés** :

- Transparence prix et promotions ;
- Respect plafond markup **300 %** (Blueprint) ;
- Contenus vitrine conformes (IP, publicité) ;
- KYC si requis ;
- DAC7 — fournir données fiscales exactes.

**Pouvoirs** :

- Publier listings (`AffiliateProduct`) ;
- Personnaliser vitrine (Brand Studio) ;
- Partager liens tracking ;
- Financer cashback acheteur depuis marge.

**Stripe** : `AffiliateProfile`, transferts commission.

**Gate légal** : middleware `reaccept-terms` si `termsAcceptedVersion` obsolète.

---

## AGENT (Partenaire sourcing)

**Rôle technique** : `User.role = "AGENT"` + entité `SourcingAgent`

**Définition juridique** : partenaire **recrutement / sourcing** de catalogue ou de marchands — **n’est pas** un revendeur au sens Affiliate Seller.

| Critère | AFFILIATE | AGENT |
|---------|-----------|-------|
| Vend au public | Oui (vitrine) | Non (pas de storefront revendeur par défaut) |
| Fixe prix public | Oui | Non |
| Contrat | CGS | **À formaliser** — aujourd’hui lien Stripe → `/conditions-affilie` (gap) |
| Rémunération | Commission vente | Commissions / incentives agent (hors scope vente directe) |

**Décision** : créer un **Agent Agreement** distinct en Phase 3+ (`07_LEGAL_ROADMAP.md`). En attendant, AGENT est traité comme partenaire B2B Affisell, pas comme Consumer-facing seller.

---

## ADMIN (Opérateur interne)

**Rôle technique** : `User.role = "ADMIN"`

**Définition** : collaborateur Affisell habilité (support, modération, finance, legal ops).

**Pouvoirs** : accès `/admin/*` (ex. `terms-logs`, review KYC `merchant-legal`).

**Obligations** : confidentialité, traçabilité actions (logs), principe du moindre privilège.

**Statut juridique** : salarié / prestataire Affisell — **pas** partie aux contrats marchands.

---

## Tableau synthétique

| Rôle | Vend au buyer | Contrat principal | Connect payout | KYC |
|------|---------------|-------------------|----------------|-----|
| CUSTOMER | — | CGU + CGV commande | — | — |
| SUPPLIER | Oui (via catalogue) | CGA | Oui | Obligatoire publish |
| AFFILIATE | Oui (via vitrine) | CGS | Oui | Selon seuils |
| AGENT | Non | Agent Agreement (TBD) | Cas par cas | TBD |
| ADMIN | Non | Employment / NDA | Non | Interne |
| AFFISELL | Non* | — | Plateforme | — |

\*Sauf opérations stock Affisell / auto-buy explicitement identifiées comme vente Affisell.

---

## Écarts audit → actions

| Écart | Action roadmap |
|-------|----------------|
| AGENT → CGS dans Stripe URL | Corriger URL + contrat Agent |
| CUSTOMER sans gate CGU outdated | PR Consentements |
| CGV non tracée checkout | PR CGV + LegalAcceptance |

---

*Référence croisée : `01_LEGAL_BLUEPRINT.md`, `03_RESPONSIBILITY_MATRIX.md`*
