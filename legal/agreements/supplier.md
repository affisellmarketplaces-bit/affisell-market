---
title: Conditions générales fournisseur (CGS)
description: Conditions applicables aux professionnels vendant sur Affisell. Version 1.0.0.
version: 1.0.0
locale: fr
lastUpdated: 2026-07-09
order: 2
---

# Conditions générales fournisseur (CGS)

**Version 1.0.0 — Dernière mise à jour : {{LAST_UPDATED}}**

Les présentes Conditions générales fournisseur (ci-après les « **CGS** ») complètent les [Conditions générales d'utilisation](/legal/terms-of-service) (CGU) et régissent la relation contractuelle entre **Affisell SAS**, société par actions simplifiée au capital de {{CAPITAL}} euros, immatriculée au RCS d'Aix-en-Provence sous le numéro {{SIREN}}, dont le siège social est situé {{ADRESSE}} (ci-après « **Affisell** », « **nous** »), et tout professionnel inscrit en qualité de **Fournisseur** sur la Plateforme Affisell.

L'inscription et l'utilisation du compte Fournisseur impliquent l'acceptation pleine et entière des présentes CGS, des CGU et de la [Politique de confidentialité](/legal/privacy-policy).

---

## Article 1 — Définitions

- **Fournisseur** : professionnel proposant des produits sur la Plateforme, fixant le prix fournisseur (wholesale), assurant l'expédition et la conformité des produits.

- **Affilié** : partenaire commercial indépendant qui sélectionne des produits du catalogue Fournisseur, les présente via une vitrine et fixe le **prix public** de revente. L'Affilié n'est pas le vendeur au sens du Code de la consommation.

- **Wholesale** ou **prix fournisseur** : prix hors taxes fixé par le Fournisseur pour un produit (`basePriceCents`), servant de base au calcul de la marge de l'Affilié.

- **Commission catalogue** (`commissionRate`) : pourcentage du prix wholesale reversé à l'Affilié, fixé par le Fournisseur pour chaque produit ou catégorie.

- **Coût revendeur** : prix plancher HT auquel l'Affilié ne peut fixer un prix public inférieur ; il correspond au wholesale HT du Fournisseur pour le SKU concerné.

- **Commande** : contrat de vente conclu entre l'Acheteur et le Fournisseur pour un seul produit, facilité par Affisell.

- **Éligibilité au reversement** (`payoutEligibleAt`) : date à partir de laquelle le reversement Fournisseur devient éligible, soit **7 jours après confirmation de livraison** par l'Acheteur ou confirmation automatique.

---

## Article 2 — Objet et qualification

2.1. **Objet.** Les présentes CGS définissent les droits et obligations du Fournisseur dans le cadre de la commercialisation de ses produits via la Plateforme, en relation avec les Affiliés et les Acheteurs.

2.2. **Qualification professionnelle.** Le Fournisseur déclare être un **professionnel** disposant d'un numéro SIRET/SIREN valide et, le cas échéant, d'un numéro de TVA intracommunautaire. Il garantit l'exactitude des informations fournies lors de l'inscription et les met à jour sans délai.

2.3. **Statut juridique.** Le Fournisseur est le **vendeur** des produits au sens du Code de la consommation. Il assume les obligations de conformité, de garanties légales, d'information précontractuelle et de service après-vente, conformément aux [CGV](/legal/terms-of-sale) applicables aux Acheteurs.

2.4. **Complémentarité.** En cas de contradiction entre les CGS et les CGU sur un point spécifique à l'activité Fournisseur, les présentes CGS prévalent pour le Fournisseur.

---

## Article 3 — Inscription, KYC/KYB et Stripe Connect

3.1. **KYC/KYB obligatoire.** Avant toute publication de catalogue, le Fournisseur doit compléter son dossier d'identification (**KYC/KYB**) : pièces d'identité des dirigeants, extrait Kbis ou équivalent, numéro de TVA, coordonnées bancaires et tout document requis par Affisell ou la réglementation applicable (DAC7, lutte anti-blanchiment).

3.2. **Profil légal marchand.** Le Fournisseur renseigne et maintient à jour son `MerchantLegalProfile` (raison sociale, adresse, représentant légal, numéros fiscaux). Aucune mise en vente n'est autorisée tant que le dossier n'est pas validé par Affisell.

3.3. **Stripe Connect obligatoire.** Le Fournisseur doit compléter l'onboarding **Stripe Connect** et maintenir un compte connecté actif pour recevoir ses reversements. L'absence de compte Connect valide entraîne la suspension des payouts et peut conduire au déréférencement du catalogue.

3.4. **Exactitude.** Toute fausse déclaration ou document falsifié constitue un manquement grave justifiant une résiliation immédiate.

---

## Article 4 — Catalogue, wholesale et commission affilié

4.1. **Fixation du wholesale.** Le Fournisseur fixe librement le **prix fournisseur hors taxes (wholesale)** pour chaque produit de son catalogue (`basePriceCents`). Il garantit que ce prix reflète les conditions commerciales réelles applicables sur la Plateforme.

4.2. **Commission catalogue (`commissionRate`).** Le Fournisseur fixe le **taux de commission catalogue** reversé à l'Affilié pour chaque produit ou catégorie, dans les plafonds techniques de la Plateforme. Ce taux est exprimé en pourcentage du wholesale HT.

4.3. **Snapshot commande.** Les taux de commission plateforme Affisell, le wholesale et le `commissionRate` applicables à une Commande sont **figés au moment de la vente** (snapshot sur la Commande) et ne peuvent être modifiés rétroactivement.

4.4. **Parité canal.** Le Fournisseur s'engage à ce que le wholesale Affisell soit **inférieur ou égal** aux prix proposés sur ses autres canaux de distribution B2B équivalents pour le même SKU, sous réserve de promotions temporaires dûment signalées sur la Plateforme.

4.5. **Modification de prix.** Toute augmentation de wholesale ou de commission doit respecter un préavis raisonnable pour les listings actifs. Affisell peut notifier les Affiliés concernés.

4.6. **Stock et fiches produits.** Le Fournisseur garantit l'exactitude des fiches produits (descriptions, images, stock, délais, conformité, garanties). Il met à jour le stock en temps réel ou selon les outils fournis par la Plateforme.

---

## Article 5 — Prix public Affilié, marge et plancher

5.1. **Prix public fixé par l'Affilié.** Le prix public affiché à l'Acheteur est fixé par l'**Affilié**, et non par Affisell ni par le Fournisseur. Le Fournisseur n'intervient pas dans la fixation du prix public final, sauf mécanisme MAP (prix plancher de revente) activé produit par produit lorsque cette fonctionnalité sera disponible.

5.2. **Plancher — coût revendeur.** L'Affilié ne peut fixer un prix public **inférieur au coût revendeur**, c'est-à-dire au **wholesale HT** fixé par le Fournisseur pour le SKU concerné.

5.3. **Plafond de marge 300 %.** Le markup appliqué par l'Affilié sur le wholesale HT **ne peut excéder 300 % (trois cents pour cent)**. Tout listing dépassant ce plafond est bloqué à la publication. Le Fournisseur est informé que la Plateforme applique cette règle pour protéger les Acheteurs et la réputation du marketplace.

5.4. **Prix manifestement abusif.** Si un wholesale manifestement déraisonnable contribue à un prix public abusif, Affisell peut suspendre le listing et solliciter le Fournisseur pour ajustement, sans préjudice de la responsabilité primaire de l'Affilié sur le prix public (voir CGU art. 5.5).

---

## Article 6 — Commission Affisell et acquisition J+7

6.1. **Commission plateforme.** Affisell prélève une **commission de plateforme** sur le montant **hors taxes** de chaque Commande, selon le barème en vigueur (taux indicatif par défaut : **10 %**, variable par catégorie ou produit). Le barème applicable est communiqué au Fournisseur lors de l'onboarding.

6.2. **Calendrier d'acquisition.** Le reversement net au Fournisseur est réputé **acquis à la date d'éligibilité au reversement** (`payoutEligibleAt`), soit **7 jours après confirmation de livraison** par l'Acheteur ou confirmation automatique (jusqu'à 10 jours après livraison si l'Acheteur reste silencieux), conformément aux CGU et au code (`PAYOUT_DAYS_AFTER_DELIVERY_CONFIRM`).

| Étape | Délai |
|-------|-------|
| Paiement | T0 |
| Livraison | Variable |
| Confirmation livraison | Jusqu'à J+10 après livraison (auto) |
| **Éligibilité reversement** | **J+7 après confirmation** |

6.3. **Exceptions.** Aucun reversement définitif n'est dû en cas de remboursement ou retour approuvé avant `payoutEligibleAt`, chargeback, blocage fraude, ou statut `REFUND_PENDING_CLAWBACK`.

6.4. **Avance Affisell.** Affisell peut, à sa discrétion, **avancer le remboursement à l'Acheteur** lorsque la loi ou la confiance consommateur l'exige, avant recouvrement auprès du Fournisseur. Cette avance ne constitue pas une reconnaissance de dette d'Affisell envers le Fournisseur.

---

## Article 7 — Paiements, reversements et clawback

7.1. **Stripe Connect.** Les reversements au Fournisseur sont effectués via **Stripe Connect** sur le compte connecté du Fournisseur, après la date `payoutEligibleAt` et sous réserve des retenues légales ou contractuelles.

7.2. **Retenues.** Affisell peut retenir temporairement des fonds en cas de suspicion de fraude, litige ouvert, non-conformité produit ou obligation légale.

7.3. **Clawback — Fournisseur débiteur principal.** En cas de remboursement à l'Acheteur, Stripe débite en priorité le **Fournisseur** puis l'**Affilié** au prorata de leurs gains sur la transaction. Si le **Transfer Reversal** échoue pour insuffisance de fonds, le **Fournisseur demeure débiteur principal** envers Affisell.

7.4. **Recouvrement.** Affisell procède au recouvrement immédiat auprès du Fournisseur, majoré des frais bancaires et de gestion. Affisell peut compenser sur les reversements futurs, suspendre les payouts et appliquer le statut `REFUND_PENDING_CLAWBACK` jusqu'à apurement de la créance.

7.5. **Compensation.** Affisell peut compenser toute somme due par le Fournisseur (remboursement Acheteur, pénalité SLA, créance clawback) avec les reversements ou soldes Connect du Fournisseur.

---

## Article 8 — Expédition, SLA et logistique

8.1. **SLA par défaut.** Le Fournisseur expédie sous **48 heures ouvrées** après confirmation du paiement, sauf délai plus long expressément affiché sur la fiche produit.

8.2. **Suivi.** Le Fournisseur fournit un numéro de suivi dès expédition lorsque le transporteur le permet.

8.3. **Retards.** En cas de retard non justifié au-delà des délais affichés ou de la procédure « Ship Pulse », Affisell peut notifier l'Acheteur, autoriser l'annulation et le remboursement, et appliquer des pénalités ou une dégradation du référencement.

8.4. **Frais RMA.** Les frais de retour marchandise (RMA) liés à un défaut de conformité **imputable au Fournisseur** sont à sa charge.

---

## Article 9 — Conformité produit, garanties et retraits

9.1. **Responsabilité produit.** Le Fournisseur est **seul responsable** de la conformité de ses produits : sécurité, étiquetage, REACH, normes applicables, documentation, garanties légales de conformité (2 ans) et vices cachés, conformément aux [CGV](/legal/terms-of-sale) art. 8.

9.2. **Garanties légales.** Le Fournisseur assure la mise en œuvre des garanties légales vis-à-vis des Acheteurs (réparation, remplacement, remboursement selon le Code de la consommation). Affisell facilite la médiation mais n'est pas fabricant ni importateur.

9.3. **Signalement et retrait sous 24 h.** En cas de signalement qualifié (défaut de conformité, produit dangereux, rappel, alerte RAPEX, injonction d'une autorité), le Fournisseur doit :

- informer Affisell **sans délai** ;
- demander le retrait du SKU concerné ;
- coopérer à l'instruction du dossier.

Affisell exécute le **retrait du listing sous 24 heures** suivant réception d'un signalement qualifié. En cas de **risque grave imminent**, Affisell peut stopper la vente **immédiatement** sans préavis.

9.4. **Produit dangereux.** Le Fournisseur, en qualité de fabricant ou importateur le cas échéant, informe les autorités compétentes dans les délais légaux (24 à 48 h selon urgence). Affisell coopère et peut signaler aux autorités si alerte crédible.

9.5. **Remboursement buyers exposés.** Le Fournisseur supporte économiquement les remboursements dus aux Acheteurs exposés ; Affisell facilite les remboursements et peut avancer selon l'article 6.4.

---

## Article 10 — Propriété intellectuelle et contenus

10.1. Le Fournisseur garantit disposer de tous les droits (marques, images, descriptions, brevets) sur les contenus qu'il publie sur la Plateforme.

10.2. Le Fournisseur concède à Affisell une licence non exclusive d'hébergement, d'affichage et d'indexation aux fins d'exploitation du service.

10.3. Le Fournisseur indemnise Affisell contre toute réclamation de tiers relative à ses produits ou contenus.

---

## Article 11 — Fiscalité et DAC7

11.1. Le Fournisseur est responsable de ses déclarations fiscales (TVA, impôts sur les sociétés, DAC7 si seuils atteints : 2 000 € ou 30 transactions / an).

11.2. Affisell peut collecter et transmettre les données requises aux autorités fiscales en qualité d'opérateur de plateforme déclarant.

11.3. Le Fournisseur accepte le mécanisme d'**auto-facturation** pour les commissions Affisell lorsque applicable.

---

## Article 12 — Résiliation et déréférencement

12.1. **Résiliation par le Fournisseur.** Le Fournisseur peut résilier son compte avec un préavis de **30 jours**, sous réserve d'exécuter les Commandes en cours et de régler les créances éventuelles.

12.2. **Résiliation et déréférencement par Affisell.** Affisell peut résilier le compte Fournisseur et procéder au **déréférencement immédiat** du catalogue, sans préavis en cas de manquement grave, notamment :

- fraude, contrefaçon ou faux documents KYC ;
- violation répétée du SLA d'expédition ;
- produit dangereux ou non conforme ;
- échec de clawback et refus de régularisation ;
- prix trompeurs ou pratiques commerciales déloyales ;
- injonction d'une autorité compétente.

12.3. **Effets.** La résiliation n'affecte pas les Commandes en cours, les obligations de garantie, les clawbacks et la conservation légale des données.

12.4. **Survie.** Les articles relatifs à la responsabilité produit, au clawback, à l'indemnisation et au droit applicable survivent à la résiliation.

---

## Article 13 — Responsabilité

13.1. Affisell est tenue d'une obligation de moyens pour la disponibilité de la Plateforme.

13.2. La responsabilité d'Affisell envers le Fournisseur est limitée conformément aux [CGU](/legal/terms-of-service).

13.3. Le Fournisseur indemnise Affisell contre toute réclamation d'un Acheteur, d'un Affilié ou d'un tiers liée à ses produits, à sa non-conformité ou à ses manquements aux présentes CGS.

---

## Article 14 — Données personnelles

Le traitement des données du Fournisseur est décrit dans la [Politique de confidentialité](/legal/privacy-policy). Le Fournisseur peut exercer ses droits RGPD via son espace marchand ou en contactant le DPO : {{DPO}}.

---

## Article 15 — Modification des CGS

Affisell peut modifier les présentes CGS. Le Fournisseur sera informé en cas de changement substantiel. L'accès au tableau de bord et la poursuite de l'activité peuvent être conditionnés à l'acceptation de la nouvelle version via l'écran de réacceptation (`/reaccept-terms?doc=supplier`).

---

## Article 16 — Droit applicable et litiges

16.1. Les présentes CGS sont soumises au **droit français**.

16.2. À défaut de résolution amiable, compétence est attribuée aux tribunaux du ressort du siège social d'Affisell, sauf disposition impérative contraire.

---

## Article 17 — Contact

**Affisell SAS** — {{ADRESSE}}  
Email Fournisseur : {{EMAIL}}  
Délégué à la protection des données : {{DPO}}
