---
title: Conditions générales fournisseur (CGS)
description: Conditions applicables aux professionnels vendant sur Affisell. Version 1.0.0 conforme Blueprint.
version: 1.0.0
locale: fr
lastUpdated: 2026-07-09
order: 2
---

# Conditions Générales Fournisseur - Affisell

**Version 1.0.0 — Effective au 09/07/2026 — Dernière mise à jour : {{LAST_UPDATED}}**

Les présentes Conditions générales fournisseur (ci-après les « **CGS** ») complètent les [Conditions générales d'utilisation](/legal/terms-of-service) (CGU) et régissent la relation entre **Affisell SAS**, société par actions simplifiée au capital de {{CAPITAL}} euros, immatriculée au RCS d'Aix-en-Provence sous le numéro {{SIREN}}, dont le siège social est situé {{ADRESSE}} (ci-après « **Affisell** »), et tout professionnel inscrit en qualité de **Fournisseur**.

L'acceptation des présentes CGS, des CGU et de la [Politique de confidentialité](/legal/privacy-policy) est requise pour publier un catalogue et recevoir des commandes sur la Plateforme.

---

## 1. Objet et rôle d'Affisell

**1.1** Le **Fournisseur** utilise Affisell comme **place de marché** pour distribuer ses produits via des **Affiliés** (partenaires curateurs) qui présentent les produits sur leur vitrine et fixent le prix public dans les bornes contractuelles.

**1.2** **Affisell** agit en qualité de **mandataire technique** et opérateur de place de marché : hébergement, checkout, paiement Stripe Connect, notifications, médiation et modération. Le **Fournisseur reste le vendeur** vis-à-vis du **Client** (Acheteur) au sens du Code de la consommation et des [CGV](/legal/terms-of-sale). Affisell n'est pas partie au contrat de vente du produit.

**1.3** Une commande sur la Plateforme correspond à **un seul produit** (panier mono-produit), conformément aux CGU et CGV Affisell.

---

## 2. Compte et conformité KYC

**2.1** **KYB obligatoire.** Avant toute publication de catalogue, le Fournisseur complète son dossier d'identification entreprise (extrait Kbis ou équivalent, bénéficiaires effectifs, pièces d'identité des dirigeants, numéro de TVA). Un **compte Stripe Connect** actif et validé est **requis** pour recevoir les reversements.

**2.2** Le Fournisseur garantit l'**exactitude** et la mise à jour de ses informations **fiscales**, **bancaires** et **produit** (fiches catalogue, stock, délais, conformité). Toute fausse déclaration constitue un manquement grave.

**2.3** Aucune mise en vente n'est autorisée tant que le profil légal marchand (`MerchantLegalProfile`) n'est pas validé par Affisell.

---

## 3. Catalogue et prix — Blueprint 300 %

**3.1** Le Fournisseur fixe librement, pour chaque produit :

- le **prix wholesale hors taxes (HT)** ;
- le **`commissionRate`** (pourcentage du wholesale reversé à l'Affilié sur la vente).

Les taux applicables à une commande sont **figés au moment de la vente** (snapshot sur la commande).

**3.2** Le **prix public** affiché au Client est fixé par l'**Affilié**, et non par Affisell ni par le Fournisseur. La **marge de l'Affilié** est **plafonnée à 300 % (trois cents pour cent)** du wholesale HT, conformément aux [CGU](/legal/terms-of-service).

**3.3** Le **prix plancher** (coût revendeur) est égal au **wholesale HT + commission Affisell** (frais de plateforme applicables sur la ligne commande). L'Affilié ne peut fixer un prix public inférieur à ce plancher. La **vente à perte** au-delà de ce plancher technique est interdite.

**3.4** Le Fournisseur garantit l'exactitude des descriptions, photographies, stocks et indications de délai sur chaque fiche produit, sous sa responsabilité exclusive.

---

## 4. Commandes et expédition

**4.1** Chaque nouvelle commande fait l'objet d'une **notification instantanée** au Fournisseur (webhook, email et/ou tableau de bord fournisseur).

**4.2** Le Fournisseur expédie dans le **délai indiqué sur la fiche produit** au moment de la commande. À défaut d'indication spécifique, le délai maximal d'expédition est de **5 jours ouvrés** après confirmation du paiement.

**4.3** Un **numéro de tracking** (suivi transporteur) est communiqué à l'Acheteur dès expédition. L'absence de tracking sur une commande expédiée constitue un manquement.

**4.4** La **confirmation de livraison** par l'Acheteur, ou l'**auto-confirmation à J+10** après livraison si l'Acheteur reste silencieux, déclenche le calendrier d'**acquisition définitive des commissions et reversements à J+7** (date `payoutEligibleAt`), conformément aux [CGU](/legal/terms-of-service).

**4.5** Les frais de retour marchandise (RMA) liés à un défaut de conformité imputable au Fournisseur sont à sa charge.

---

## 5. Paiements et clawback — Blueprint critique

**5.1** Les fonds payés par le Client sont **détenus par Stripe** (custody Stripe Connect) jusqu'à l'**expédition** du produit par le Fournisseur et, le cas échéant, jusqu'à l'éligibilité aux reversements selon les règles de la Plateforme.

**5.2** Le **transfer** vers le compte Connect du Fournisseur intervient à **J+7 après confirmation de livraison** (`payoutEligibleAt`), sous réserve d'absence de litige, remboursement, chargeback ou blocage fraude.

**5.3** En cas de **remboursement Client**, Affisell procède via **Stripe Transfer Reversal**. Le **Fournisseur est débité en priorité**, puis l'Affilié au prorata de leurs gains sur la transaction.

**5.4** Si le **Transfer Reversal échoue** pour **insuffisance de fonds**, le **Fournisseur demeure débiteur principal** envers Affisell. Affisell peut suspendre les reversements futurs, appliquer le statut `REFUND_PENDING_CLAWBACK` et compenser sur les ventes ultérieures.

**5.5** Affisell peut, à sa discrétion, **avancer le remboursement** au Client afin de préserver la confiance de la plateforme. Cette avance **ne constitue pas une reconnaissance de dette** d'Affisell envers le Fournisseur et fera l'objet d'un **recouvrement immédiat** auprès du Fournisseur, **majoré des frais bancaires et de gestion**.

**5.6** Affisell prélève une **commission de plateforme** sur le montant HT de chaque commande, selon le barème en vigueur communiqué lors de l'onboarding.

---

## 6. Responsabilité produit — Blueprint 24 h

**6.1** Le Fournisseur garantit la **conformité**, la **sécurité**, le respect des **normes applicables** (dont marquage CE le cas échéant) et l'**absence de contrefaçon** sur l'ensemble de son catalogue.

**6.2** En cas de signalement par la **DGCCRF**, une **autorité de régulation**, un Acheteur ou un tiers qualifié concernant un produit non conforme ou dangereux, le Fournisseur coopère immédiatement. Affisell exécute le **retrait du listing sous 24 heures ouvrées** suivant réception d'un signalement qualifié.

**6.3** Si le Fournisseur est **défaillant** (absence de réponse, refus de retrait, non-conformité avérée), Affisell procède à une **déréférencement immédiate** du catalogue ou du SKU concerné. Les **frais** liés au traitement du signalement, aux remboursements facilités et au recouvrement peuvent être **mis à la charge du Fournisseur**.

**6.4** Le Fournisseur assume la **responsabilité primaire** sur le **rappel produit**, la **garantie légale de conformité (2 ans à compter de la livraison)** et les **vices cachés (2 ans à compter de la découverte)**, conformément aux [CGV](/legal/terms-of-sale) art. 7 et au Code de la consommation. Affisell facilite la médiation mais n'est pas fabricant ni importateur.

**6.5** En cas de produit présentant un **risque grave imminent**, Affisell peut stopper la vente **immédiatement** sans préavis.

---

## 7. Résiliation

**7.1** Affisell peut procéder à un **déréférencement immédiat** et à la résiliation du compte Fournisseur en cas de : **contrefaçon**, **danger pour les consommateurs**, **fraude**, **violation KYC/KYB**, échec de clawback non régularisé, ou injonction d'une autorité compétente.

**7.2** Les **commissions acquises** (éligibles à `payoutEligibleAt`) sont versées selon les règles Stripe Connect, sous réserve de créances et clawbacks en cours. Les **commandes en cours** restent **honorées** par le Fournisseur (expédition, SAV, garanties).

**7.3** À la résiliation, les **données** nécessaires aux obligations légales et comptables du Fournisseur et d'Affisell sont **conservées 10 ans**, conformément aux obligations comptables et fiscales françaises.

**7.4** Le Fournisseur peut résilier son compte avec un préavis de **30 jours**, sous réserve d'exécuter les commandes en cours et de régler toute créance Affisell.

---

## 8. Droit applicable

**8.1** Les présentes CGS sont soumises au **droit français**.

**8.2** À défaut de résolution amiable, tout litige relatif à l'exécution des présentes CGS relève de la compétence du **Tribunal de Commerce de Paris**, sous réserve des dispositions impératives contraires.

---

## 9. Contact

**Affisell SAS** — {{ADRESSE}}  
Email Fournisseur : {{EMAIL}}  
Délégué à la protection des données : {{DPO}}
