---
title: Conditions générales affilié (CGA)
description: Conditions applicables aux créateurs et partenaires Affisell. Version 1.0.0 conforme Blueprint.
version: 1.0.0
locale: fr
lastUpdated: 2026-07-09
order: 3
---

# Conditions Générales Affilié - Affisell

**Version 1.0.0 — Effective au 09/07/2026 — Dernière mise à jour : {{LAST_UPDATED}}**

Les présentes Conditions générales affilié (ci-après les « **CGA** ») complètent les [Conditions générales d'utilisation](/legal/terms-of-service) (CGU) et régissent la relation entre **Affisell SAS**, société par actions simplifiée au capital de {{CAPITAL}} euros, immatriculée au RCS d'Aix-en-Provence sous le numéro {{SIREN}}, dont le siège social est situé {{ADRESSE}} (ci-après « **Affisell** »), et tout partenaire inscrit en qualité d'**Affilié** (créateur, influenceur, curateur de vitrine).

L'acceptation des présentes CGA, des CGU et de la [Politique de confidentialité](/legal/privacy-policy) est requise pour publier une vitrine et percevoir une rémunération partenaire sur la Plateforme.

---

## 1. Statut et Mandat

**1.1** L'**Affilié** est **mandataire commercial indépendant** : il sélectionne, présente et commercialise des produits de Fournisseurs via sa vitrine Affisell. **Aucun contrat de travail** n'est conclu entre l'Affilié et Affisell. L'Affilié **n'est pas le vendeur** des marchandises : le contrat de vente est conclu entre l'**Acheteur** et le **Fournisseur**, conformément aux [CGU](/legal/terms-of-service) et aux [CGV](/legal/terms-of-sale).

**1.2** **Affisell** fournit une **plateforme technique d'affiliation** : hébergement de vitrine, checkout, paiement Stripe Connect, outils de pricing, notifications et modération. Affisell n'expédie pas les produits, ne détient pas le stock et n'émet pas la facture de vente du bien au consommateur final.

**1.3** L'Affilié agit en qualité de **professionnel ou non-professionnel** selon sa déclaration. Il demeure seul responsable de son immatriculation, de ses déclarations sociales et fiscales afférentes à sa **rémunération partenaire**, sans préjudice des obligations de reporting imposées à Affisell en tant qu'opérateur de plateforme (notamment DAC7).

---

## 2. Inscription et Validation

**2.1** **KYC/KYB** : si l'Affilié agit en qualité de **personne morale**, il fournit un dossier d'identification entreprise (extrait Kbis ou équivalent, bénéficiaires effectifs, pièces d'identité des dirigeants, numéro de TVA le cas échéant). Un **compte Stripe Connect** actif et validé est **obligatoire** pour percevoir les reversements.

**2.2** Affisell se réserve le droit de **refuser**, **suspendre** ou **résilier** tout compte Affilié en cas de dossier incomplet, signalement qualifié, fraude, violation des présentes CGA ou injonction d'une autorité compétente.

**2.3** Aucune mise en ligne de vitrine ou de listing n'est autorisée tant que le profil légal marchand (`MerchantLegalProfile`) et le compte Stripe Connect requis ne sont pas validés.

---

## 3. Fixation des Prix — CLAUSE BLUEPRINT

**3.1** L'**Affilié fixe librement le prix de vente public** de chaque produit promu sur sa vitrine, dans les bornes contractuelles définies ci-après et aux [CGU](/legal/terms-of-service) article 5.

**3.2** La **marge de l'Affilié** est **plafonnée à 300 % (trois cents pour cent)** du **prix wholesale hors taxes (HT)** fixé par le Fournisseur. Tout listing dépassant ce plafond est **bloqué à la publication**, conformément aux [CGV](/legal/terms-of-sale) article 3 et aux [CGS](/legal/terms-supplier) article 3.

**3.3** Le **prix plancher automatique** est égal au **wholesale HT + commission Affisell** (frais de plateforme applicables sur la ligne commande). L'Affilié ne peut fixer un prix public **inférieur** à ce plancher. La vente à perte au-delà de ce plancher technique est interdite.

**3.4** Affisell peut **suspendre un listing sous 48 heures ouvrées** si le prix public est **manifestement abusif** au regard des pratiques du marché, sur signalement d'un Acheteur, d'un Fournisseur ou d'une autorité de régulation. L'Affilié sera notifié et pourra soumettre ses observations. La décision de réactivation appartient à Affisell après analyse, conformément aux [CGU](/legal/terms-of-service) article 5.5.

---

## 4. Commissions — CLAUSE BLUEPRINT

**4.1** La **commission Affilié** sur une vente est calculée selon la formule suivante :

**Commission = (Prix Public TTC − Wholesale HT) × Taux de commission du produit**

Le **taux de commission** (`commissionRate`) est fixé par le Fournisseur sur la fiche produit et **figé au moment de la vente** (snapshot sur la commande). Les montants applicables sont consultables sur le tableau de bord Affilié.

**4.2** La commission est **acquise définitivement à J+7** après **confirmation de livraison** par l'Acheteur, ou **auto-confirmation à J+10** après livraison si l'Acheteur reste silencieux (date `payoutEligibleAt`), conformément aux [CGU](/legal/terms-of-service) article 6.3.

**4.3** Le **versement** intervient via **Stripe Connect**, dans un délai **maximum de 30 jours** après la date d'éligibilité (J+7), sous réserve d'atteinte du **seuil minimal de 50 €** de solde éligible. Les fonds inférieurs au seuil sont reportés au cycle suivant.

**4.4** En cas de **remboursement Client** (rétractation, retour approuvé, garantie légale), Affisell procède via **Stripe Transfer Reversal**. L'**Affilié est débité au prorata** de sa commission sur la transaction concernée.

**4.5** Si le **Transfer Reversal échoue** pour insuffisance de fonds, l'**Affilié reste débiteur envers Affisell** du montant de la commission à recouvrer. Affisell peut suspendre les reversements futurs, appliquer le statut `REFUND_PENDING_CLAWBACK` et compenser sur les ventes ultérieures. Le Fournisseur demeure débiteur principal au sens des [CGU](/legal/terms-of-service) article 6.5 ; le recouvrement Affilié s'exerce **en complément** au prorata de ses gains.

**4.6** Affisell prélève des **frais de plateforme** sur le montant HT de chaque commande selon le barème en vigueur communiqué lors de l'onboarding, prélevés avant calcul de la rémunération nette Affilié.

---

## 5. Obligations Marketing

**5.1** Sont **interdits** : **spam**, **achat de mots-clés** sur la marque d'un Fournisseur ou d'Affisell sans autorisation écrite, **publicité trompeuse**, fausses réductions, présentation de l'Affilié comme vendeur du produit, contrefaçon et contenus illicites.

**5.2** L'**Affilié est seul responsable** du contenu de ses promotions (textes, vidéos, embeds, réseaux sociaux). Il garantit disposer des droits nécessaires sur les contenus qu'il publie et respecter les règles des plateformes tierces (Meta, TikTok, YouTube, etc.).

**5.3** Si l'Affilié **collecte des données prospects** (newsletter, formulaire, lead magnet), il respecte le **RGPD** et la [Politique de confidentialité](/legal/privacy-policy) Affisell : base légale, information, droits des personnes, sécurité et durée de conservation.

---

## 6. Propriété Intellectuelle

**6.1** Le Fournisseur concède, via Affisell, une **licence d'usage non exclusive** des **visuels produits** fournis sur la Plateforme, limitée à la promotion des produits listés par l'Affilié sur sa vitrine Affisell.

**6.2** L'**Affilié s'interdit de modifier** les visuels produits (retouche, déformation, altération de marque) **sans accord écrit** du Fournisseur ou d'Affisell. Toute création originale de l'Affilié reste sa propriété ; l'Affilié concède à Affisell une licence non exclusive pour héberger et afficher ses contenus de vitrine.

---

## 7. Résiliation et Sanctions

**7.1** Affisell procède à un **déréférencement immédiat** et peut résilier le compte Affilié en cas de : **fraude au clic**, **spam**, **violation du plafond de marge 300 %**, **contrefaçon**, publicité trompeuse grave ou injonction d'une autorité compétente.

**7.2** Les **commissions acquises** avant sanction (éligibles à `payoutEligibleAt`) sont **versées** selon les règles Stripe Connect, sous réserve de créances et clawbacks en cours. Les **commissions en cours d'acquisition** (entre livraison et J+7) sont **gelées** le temps de l'instruction du litige.

**7.3** Les **données** nécessaires aux obligations légales et comptables de l'Affilié et d'Affisell sont **conservées 10 ans**, conformément aux obligations comptables et fiscales françaises.

**7.4** L'Affilié peut résilier son compte avec un préavis de **30 jours**, sous réserve d'honorer les commandes en cours et de régler toute créance Affisell.

---

## 8. Droit Applicable

**8.1** Les présentes CGA sont soumises au **droit français**.

**8.2** À défaut de résolution amiable, tout litige relatif à l'exécution des présentes CGA relève de la compétence du **Tribunal de Commerce de Paris**, sous réserve des dispositions impératives contraires.

---

## 9. Contact

**Affisell SAS** — {{ADRESSE}}  
Email Affilié : {{EMAIL}}  
Délégué à la protection des données : {{DPO}}
