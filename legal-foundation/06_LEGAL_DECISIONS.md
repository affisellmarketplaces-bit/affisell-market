# 06 — LEGAL DECISIONS LOG

> **Statut** : interne · v2026-07-09  
> Format : `YYYY-MM-DD : Décision. Décideur. Raison.`

---

## 2026-07-09

**Marge max autorisée = 300 % du wholesale.**  
Décision : CEO.  
Raison : éviter abus prix public, alignement pratiques marketplace, gap audit « 500 % non tranchée ».

---

**Affiliate Seller peut vendre moins cher que le prix suggéré.**  
Décision : CEO.  
Raison : liberté commerciale ; seul le plancher wholesale + commission structure impose un minimum économique.

---

**Prix abusif : responsabilité primaire Affiliate Seller, due diligence Affisell.**  
Décision : CEO.  
Raison : l’affilié fixe le prix public ; la plateforme modère et peut retirer sous 24–48 h.

---

**Promos / cashback / coupons : financés par l’Affiliate sauf campagne plateforme explicite.**  
Décision : CEO.  
Raison : gap audit « qui finance promos » ; pas de subvention Affisell implicite.

---

**Custody fonds : Stripe jusqu’aux Transfers Connect ; Affisell n’est pas dépositaire bancaire.**  
Décision : CEO.  
Raison : modèle Connect existant ; clarté propriété économique pré-reversement.

---

**Commission acquise définitivement à `payoutEligibleAt` (J+7 post-confirmation livraison), sous réserve remboursements / clawback.**  
Décision : CEO.  
Raison : alignement `lib/order-payout-policy.ts` ; fenêtre litige buyer.

---

**Échec Transfer Reversal : marchand débiteur en premier ; Affisell peut avancer remboursement buyer puis clawback.**  
Décision : CEO.  
Raison : gap audit « qui paie si reversal fail » ; protection consommateur prioritaire.

---

**Produit dangereux : retrait primaire Supplier, exécution Affisell sous 24 h, remboursement selon flux standard.**  
Décision : CEO.  
Raison : responsabilité produit chez fournisseur ; Affisell opère takedown plateforme.

---

**Gate CGS/CGA seulement (pas CGU/Privacy/CGV checkout) = dette technique acceptée Phase 1.**  
Décision : CEO.  
Raison : gap audit « gate partiel » ; correction planifiée Phase 2+ (roadmap).

---

**Agent ≠ Affiliate Seller ; contrat Agent Agreement à produire avant activation commerciale Agent.**  
Décision : CEO.  
Raison : rôles distincts dans le code (`AGENT` vs `AFFILIATE`) ; pas de contrat Agent publié aujourd’hui.

---

**DAC7 : seuils internes 2 000 € ou 30 transactions / an pour disclosure marchand.**  
Décision : CEO.  
Raison : alignement pratique UE ; export affilié existant.

---

**KYC/KYB obligatoire supplier avant publish catalogue ; affilié avant premier payout si enforcement actif.**  
Décision : CEO.  
Raison : conformité AML + DAC7 ; `MerchantLegalProfile` existant.

---

**Juridiction litiges plateforme : droit français ; tribunaux Paris (sous réserve consommateur UE).**  
Décision : CEO.  
Raison : siège Affisell ; cohérence CGU futures.

---

**Versioning contrats : semver document + `TermsAcceptanceLog` ; pas de `LegalDocument` Prisma en Phase 1.**  
Décision : CEO.  
Raison : gap audit absence modèle LMS ; Phase 2 PR infra.

---

*Nouvelles entrées : ajouter en tête de fichier, ne pas modifier les décisions passées (append-only).*
