# 01 — LEGAL BLUEPRINT (Constitution Affisell)

> **Statut** : document interne de référence — **n’est pas** un contrat public.  
> **Version** : 2026-07-09 · **Audience** : Legal, Product, Engineering, Ops.  
> **Base** : audit Phase 0 (repo `affisell-market`) + modèle marketplace 1 commande = 1 produit.

---

## 1. Vision

Affisell est une **marketplace d’affiliation européenne** qui met en relation :

- des **Fournisseurs (Supplier)** qui publient un catalogue et expédient ;
- des **Revendeurs affiliés (Affiliate Seller)** qui revendent via leur vitrine ;
- des **Acheteurs (Customer)** qui commandent en ligne.

Affisell fournit l’infrastructure (vitrine, checkout, paiement Stripe Connect, conformité, support plateforme) et prélève des **frais plateforme** documentés. Affisell **n’est pas** le vendeur au sens du Code de la consommation sauf cas expressément désignés (stock Affisell / auto-buy documenté).

**Principe directeur** : *ce qui est automatisé dans le code doit être explicable dans un contrat ; ce qui est dans un contrat doit être vérifiable dans les logs.*

---

## 2. Rôles (résumé — détail dans `02_ROLE_DEFINITIONS.md`)

| Rôle technique | Rôle juridique simplifié |
|----------------|--------------------------|
| `CUSTOMER` | Consommateur ou pro acheteur |
| `AFFILIATE` | Revendeur / créateur (Affiliate Seller) |
| `SUPPLIER` | Commerçant fournisseur |
| `AGENT` | Partenaire sourcing (statut distinct du revendeur) |
| `ADMIN` | Opérateur Affisell |
| — | **Affisell** = opérateur de plateforme |

---

## 3. Flux produits

```
Supplier catalogue → Affiliate listing (prix, marge) → Storefront public → Checkout → Fulfillment Supplier
```

- **1 Order = 1 produit** (pas de panier multi-SKU contractuel standard).
- Le **Supplier** reste responsable de la conformité produit (sécurité, étiquetage, garantie légale).
- L’**Affiliate Seller** choisit quels SKU lister et le **prix public** dans les bornes Affisell.
- **Affisell** peut retirer ou suspendre une fiche (modération, signalement, injonction).

---

## 4. Flux paiements (résumé — détail dans `04_MONEY_FLOW.md`)

```
Customer → Stripe Checkout → Fonds sur compte plateforme Connect
         → Split logique : Supplier payout | Affiliate payout | Affisell fees
         → Transferts Connect après éligibilité payout
```

Références code actuelles : `lib/stripe-sync-order-vat-from-session.ts`, `lib/order-payout-policy.ts`, `lib/marketplace-phase1-fees.ts`.

---

## 5. Flux juridiques

| Moment | Document | Preuve technique cible |
|--------|----------|------------------------|
| Inscription Customer | CGU + Privacy | `User.cgu*`, `User.privacy*` |
| Inscription Supplier / Affiliate | CGU + Privacy + CGS/CGA | `TermsAcceptanceLog` |
| Mise à jour CGS/CGA | Réacceptation | Middleware `reaccept-terms` |
| Checkout | CGV / conditions de vente | **À implémenter** (gap Phase 0) |
| Cookies | ePrivacy | `cookieConsent` + bannière |
| KYC marchand | Dossier identité | `MerchantLegalProfile` |

---

## 6. Responsabilités (résumé — matrice complète dans `03_RESPONSIBILITY_MATRIX.md`)

Affisell applique un modèle **« responsabilité primaire chez le marchand, due diligence plateforme »**, aligné DSA / pratiques marketplace EU.

---

## 7. Propriété intellectuelle

- **Supplier** garantit droits sur images, marques, descriptions.
- **Affiliate Seller** garantit droits sur contenus de vitrine (texte, vidéo, embed).
- **Affisell** détient licence non exclusive sur contenus hébergés pour exploitation du service (hébergement, indexation, modération, sauvegarde légale).
- Signalement contrefaçon : procédure notice-and-takedown (à formaliser en policy IP).

---

## 8. Fiscalité

- **TVA** : calculée au checkout via Stripe Tax ; enregistrée sur `Order.taxCents` (HT/TVA/TTC).
- **Affiliate / Supplier** : responsables de leurs déclarations ; Affisell peut collecter/transmettre données **DAC7** (seuils EU).
- Numéros TVA : champs `vatNumber` (User, MerchantLegalProfile).

---

## 9. RGPD

- Export / suppression : `/api/gdpr/export`, `/api/gdpr/delete`.
- Consentements : stockage User + journal `TermsAcceptanceLog`.
- DPO : contact via placeholder `{{DPO}}` dans policies publiques.
- Registre des traitements : **à compléter** hors scope code.

---

## 10. DAC7

- Seuils de référence disclosure : **2 000 €** et **30 transactions** / an (voir `lib/supplier-become-page-finance.ts`).
- Export CSV affilié : `/api/affiliate/dac7-export`.
- Affisell = **opérateur de plateforme déclarant** ; marchands = **obligés de fournir des données exactes**.

---

## 11. Gouvernance

| Domaine | Décideur | Validation |
|---------|----------|------------|
| Frais plateforme Affisell (bps) | CEO + Finance | `06_LEGAL_DECISIONS.md` |
| Plafonds marge affilié | CEO + Legal + Product | Blueprint + futur param produit |
| Retrait produit / compte | Trust & Safety + Legal | Matrice responsabilités |
| Révision contrats publics | Legal | Roadmap Phase 3+ |
| Incidents sécurité produit | Legal + Ops (escalade CEO) | Runbook (à créer) |

---

## 12. Résolution des litiges

- **B2C** : médiation consommation (lien ODR footer), droit français si siège FR.
- **B2B marchands** : tribunaux compétents du siège Affisell sauf clause contraire dans CGS/CGA.
- **Paiements** : chargebacks gérés via Stripe ; clawback marchand si remboursement.

---

## 13. Versioning

- Tout document public doit avoir : `version`, `publishedAt`, `locale`, `contentHash`.
- Réacceptation forcée si version majeure impactant droits/obligations.
- **État actuel (gap)** : versions en constantes TS (`CGU_VERSION`, etc.) — migration vers LMS Phase 2.

---

## 14. Internationalisation

- Locales cibles : `fr`, `en`, `de`, `es`, `it`, `nl`, `pl`, `zh`.
- Source affichage actuelle : `legal/content/{locale}/*.md`.
- En cas de divergence FR / EN : **FR fait foi** pour entité FR ; traductions = information.

---

## 15. Évolutions futures

- Acceptation CGV tracée par commande.
- Gate CGU/Privacy customer outdated.
- MAP (prix minimum annoncé) supplier par SKU.
- Contrats Supplier / Affiliate / Customer séparés du socle CGU.
- Policy IP, DSA transparency report.

---

# DÉCISIONS OBLIGATOIRES (tranchées)

## Q1 — Qui décide commission / marge ? Le fournisseur peut-il plafonner la marge ?

| Levier | Décideur | Mécanisme |
|--------|----------|-----------|
| **Prix fournisseur (wholesale)** | Supplier | `Product.basePriceCents` / prix catalogue |
| **Taux de commission catalogue** (part du wholesale reversée à l’affilié) | Supplier (défaut) + Affisell (plafonds catégorie) | `commissionRate` (bps ou %) |
| **Prix public final** | Affiliate Seller | `AffiliateProduct.sellingPriceCents`, `marginCents` |
| **Frais plateforme Affisell** | Affisell | `supplierFeeBps`, `affiliatePlatformFeeBps`, overrides catégorie |

**Plafonnement marge par le Supplier** :

- **Oui, indirectement** : le Supplier fixe le wholesale et le taux de commission max alloué à l’affilié.
- **Non, pas de plafond direct sur le markup %** en V1 — sauf **prix plancher de revente (MAP)** si activé produit par produit (feature future, référencée ici).
- Affisell peut imposer un **plafond de markup affilié** (voir Q2) indépendamment du Supplier.

---

## Q2 — L’Affiliate Seller peut-il vendre moins cher ? Marge 500 % autorisée ?

**Vendre moins cher** : **OUI**, tant que :

1. `sellingPriceCents ≥ supplierPriceCents` (jamais de vente sous le coût fournisseur) ;
2. frais Stripe / TVA / frais plateforme restent couverts ou absorbés par l’affilié ;
3. pas de pratique trompeuse (fausse réduction, prix barré fictif).

**Marge 500 %** : **NON**.

| Règle | Valeur | Justification |
|-------|--------|---------------|
| **Markup max sur prix fournisseur HT** | **300 %** | Limite abus / réputation / risque répression prix (pratiques commerciales déloyales) |
| **Markup au-delà de 300 %** | Listing bloqué à la publication + alerte review | Alignement décision `06_LEGAL_DECISIONS.md` |
| **Commission rate technique max (catalogue)** | Conserver plafonds code existants (99 % physical / 100 % digital sur *commission*, pas markup global) | Ne pas confondre commission % et markup % |

> *Note engineering* : le plafond 300 % markup est une **décision juridique** à implémenter en Phase 2+ (validation listing). Non présent uniformément dans le code au 2026-07-09.

---

## Q3 — Qui est responsable si prix jugé abusif ?

| Acteur | Responsabilité |
|--------|----------------|
| **Affiliate Seller** | **Primaire** — il fixe le prix public |
| **Supplier** | **Secondaire** — wholesale déraisonnable, consignes MAP futures |
| **Affisell** | **Due diligence plateforme** — monitoring, signalement, retrait listing, coopération autorités |

En cas de pratique abusive avérée : retrait immédiat du listing, suspension compte affilié, remboursement buyer selon CGV, recours contre marchand fautif.

---

## Q4 — Qui finance promos / coupons / remises ?

| Type | Financeur | Mécanisme actuel / cible |
|------|-----------|-------------------------|
| **Cashback acheteur** (récompense listing) | **Affiliate Seller** (depuis sa marge) | `buyerRewardCents` / marge |
| **Coupon code plateforme** | **Affisell** (si campagne Affisell) | Future — budget marketing |
| **Remise Supplier** | **Supplier** | Future — promo catalogue |
| **Remise Affiliate** | **Affiliate** (réduction marge) | Baisse `sellingPriceCents` |

**Règle** : toute remise doit être **attribuable** à un acteur dans le ledger commande (champ `discountFundedBy` — à implémenter).

---

## Q5 — À qui appartient l’argent avant reversement Stripe ?

| Phase | Détenant juridique / économique |
|-------|----------------------------------|
| Paiement checkout réussi | **Stripe** (custody) sur compte Connect plateforme |
| Avant split | Fonds **ségrégués** au sens Stripe Connect ; Affisell **orchestre** les transferts |
| Après transfert Connect | Compte connecté du **Supplier** ou **Affiliate** (selon split) |

Affisell **ne revendique pas la propriété** des fonds destinés aux marchands ; elle détient droit aux **frais plateforme** et mécanismes de **clawback**.

---

## Q6 — Quand la commission devient-elle définitivement acquise ?

**Définition « acquise »** = éligible au payout **et** hors fenêtre de remboursement standard **sauf** chargeback ultérieur.

| Étape | Délai (réf. code) | Effet |
|-------|-------------------|-------|
| Paiement | T0 | Commande `paid` |
| Livraison | Variable | `deliveredAt` |
| Confirmation acheteur ou auto | +10 j après livraison (auto) | `deliveryConfirmedAt` |
| **Éligibilité payout** | **+7 j après confirmation** | `payoutEligibleAt` |
| Transfert Connect | Job transfers | `payoutStatus` → settled |

**Commission Affisell + gains Affiliate + payout Supplier** : acquis à **`payoutEligibleAt`**, **sous réserve** de :

- remboursement / retour approuvé avant payout ;
- clawback si remboursement post-payout ;
- blocage `REFUND_PENDING_CLAWBACK`.

---

## Q7 — Remboursement : si Stripe Transfer Reversal échoue, qui paie ?

| Ordre | Obligé | Action |
|-------|--------|--------|
| 1 | **Marchand bénéficiaire** (Supplier et/ou Affiliate selon split) | Solde Connect, clawback ledger |
| 2 | **Affisell** | Avance le remboursement **acheteur** si obligation légale immédiate |
| 3 | **Recouvrement Affisell** | Créance sur marchand (`REFUND_PENDING_CLAWBACK`, suspension, compensation futures ventes) |

**Règle** : Affisell **n’assume pas** l’échec de reversal comme perte définitive sauf décision exceptionnelle CEO (fraude buyer avérée, insolvabilité marchand — log dans `06_LEGAL_DECISIONS.md`).

L’acheteur **est toujours remboursé** si le remboursement est dû au sens CGV / droit consommation ; le litige économique est **internalisé** avec le(s) marchand(s).

---

## Q8 — Produit dangereux : responsabilité, retrait, remboursement, autorités

| Action | Responsable primaire | Responsable plateforme | Délai cible |
|--------|-------------------|----------------------|-------------|
| **Conformité produit** | Supplier | Due diligence onboarding KYC | Continu |
| **Retrait listing** | Supplier (demande) + Affisell (exécution) | Affisell | **24 h** après signalement qualifié |
| **Stop vente / alerte** | Affisell | — | Immédiat si risque grave imminent |
| **Remboursement buyers exposés** | Supplier (économique) | Affisell (facilitation, avance si nécessaire) | Selon gravité, priorité < 72 h |
| **Information autorités** | **Supplier** (fabricant / importateur) | **Affisell** coopère + signale si alerte RAPEX / autorité compétente | **24–48 h** selon urgence |

**Affisell** n’est pas fabricant ; obligation **DSA** de moyens renforcés sur signalement crédible.

---

## Annexe — Alignement code ↔ décisions

| Décision | État code 2026-07-09 |
|----------|----------------------|
| Payout J+7 post-confirm | ✅ `PAYOUT_DAYS_AFTER_DELIVERY_CONFIRM` |
| Clawback refund | ✅ `OrderStripeRefund`, `REFUND_PENDING_CLAWBACK` |
| Plafond markup 300 % | ❌ À implémenter |
| CGV accept checkout | ❌ À implémenter |
| Gate CGU/Privacy | ❌ Partiel (CGS/CGA only) |

---

*Document interne — ne pas publier tel quel. Toute publication passe par LMS + Legal review.*
