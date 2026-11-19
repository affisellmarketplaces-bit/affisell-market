# Cycle d'innovation — simplifier radicalement la vie des fournisseurs et des revendeurs

Ouvert le 19 novembre 2026, sur demande du fondateur. Priorité non négociable : le catalogue alimenté directement par les fournisseurs. Parcours : Fournisseur → Catalogue → Revendeur → Acheteur → Commande → Paiement → Livraison → Retour. L'approvisionnement externe reste complémentaire.

Méthode suivie : partir des frictions **lues dans le code**, retenir trois innovations, développer la première tout de suite. Les systèmes qui fonctionnent ne sont pas réécrits, et chaque chiffre dit s'il est vérifié, déclaré, calculé ou hypothétique.

## 1. Frictions constatées dans le code

| # | Parcours | Friction (fichier) | Conséquence |
|---|---|---|---|
| F1 | Revendeur | Le « Revenu revendeur estimé » de chaque carte du catalogue valait commission + marge (`lib/affiliate-catalog-margin-display.ts`). Les frais Affisell côté revendeur (20 % par défaut, `DEFAULT_AFFILIATE_PLATFORM_FEE_BPS`, ou taux négocié `User.affiliatePlatformFeeBps`), prélevés au virement, n'y figuraient pas. | Chaque carte surestimait le gain réel d'environ 25 % (brut affiché ÷ net versé). Risque de déception et de perte de confiance. |
| F2 | Revendeur | Le « Prix client suggéré » est **hors taxes** : la TVA s'ajoute au paiement (`buildHtLineItem`), sans que la carte le dise. | Le revendeur sous-estime le prix réellement payé par son acheteur. |
| F3 | Revendeur | Pour choisir quoi vendre, il faut ouvrir les produits un par un. Rien ne signale qu'un produit **ne peut pas être vendu** : sans commission explicite, l'acheteur paie mais la ligne ne devient pas une commande (`commission_not_explicit`, `lib/stripe-marketplace-fulfill.ts`). Rien non plus pour un produit en rupture. | Du temps perdu, et des produits invendables ajoutés à la boutique. |
| F4 | Fournisseur | L'assistant v2 publie un stock fixe de 99 et, sans prix saisi, un prix de **10 €** (`lib/product-wizard-v2/build-publish-payload.ts`). D'autres imports écrivent 99 ou 999. | Le catalogue contient des données inventées, présentées comme déclarées. |
| F5 | Fournisseur | Le parcours de commercialisation existe **produit par produit** (`product-journey.ts`). Aucune vue d'ensemble ne montre ce qui empêche de vendre dans tout le catalogue, ni par où commencer. | Le fournisseur ne sait pas quel produit corriger en premier. |
| F6 | Revendeur | Une carte du catalogue affiche l'**e-mail du fournisseur** quand sa boutique n'a pas de nom (`supplierLabel`, `affiliate-catalog-experience.tsx`). | Exposition d'une donnée de contact. À trancher : remplacer par un libellé neutre ou garder un contact direct. |

## 2. Les trois innovations retenues

Elles sont choisies pour les tâches qu'elles suppriment et leur potentiel commercial.

### Innovation 1 — Copilote revendeur : « gain net réel » et « sélection prête à vendre » (développée)

**Tâches supprimées** :

- calculer à la main ce qu'une vente rapporte ;
- ouvrir les fiches une à une ;
- découvrir après coup qu'un produit est invendable ;
- ajouter les produits un par un.

**Ce qui est livré :**

- **Net réel par vente** (`lib/reseller-copilot/net-per-sale.ts`) :
  - calcul : commission + marge − frais Affisell côté revendeur, au taux propre du revendeur ;
  - fidélité : un test le compare au vrai règlement (`computeMarketplaceOrderSettlement`, `computePhase1OrderFees`, `netAffiliateTransferCents`) sur une grille de 1 260 combinaisons ;
  - prix acheteur : le prix TTC payé par l'acheteur est donné comme une **estimation** (TVA française à 20 % ; le taux réel est fixé au paiement).
- **Cartes du catalogue corrigées** (F1, F2) : elles montrent le **net**, son détail (brut − frais, avec le taux) et l'indication « prix hors taxes ». Le catalogue reçoit le taux négocié du revendeur.
- **Sélection prête à vendre** (`lib/reseller-copilot/selection.ts` + `.server.ts`) :
  - périmètre : les produits du catalogue que le revendeur n'a pas encore, avec les mêmes règles de visibilité que son catalogue (exclusivités respectées) ;
  - classement : « prêts » d'abord, puis « à vérifier » ; à l'intérieur, net le plus élevé, puis demande observée ;
  - produits écartés : affichés à part, avec leur raison :
    - pas de commission (la vente serait perdue) ;
    - rupture de stock ;
    - import en attente de validation ;
    - prix fournisseur absent.
  - « à vérifier » : stock invérifiable, très bas, ou net faible ;
  - qualification de chaque chiffre : `catalogue` (conditions publiées par le fournisseur), `calcul`, `observe` (commandes payées sur Affisell sur 30 jours). **Aucune prévision de ventes.**
- **Ajout en une fois** (`POST /api/affiliate/copilot/selection`) :
  - jusqu'à 20 produits par action ;
  - chacun est **réévalué** au moment de l'ajout (un produit en rupture depuis l'affichage est refusé) ;
  - l'ajout passe par l'ajout rapide existant (`quickAddAffiliateListing`) : mêmes règles et mêmes contrôles de publication qu'un ajout manuel, rien de nouveau n'est écrit.
- **Panneau** en tête du catalogue revendeur, traduit en 8 langues.

### Innovation 2 — Copilote fournisseur : santé du catalogue (développée)

**Tâche supprimée** : chercher produit par produit ce qui bloque, ou rend douteuses, les ventes.

**Construit** : `lib/supplier-catalog-health/diagnose.ts` (pur) + `.server.ts` (lecture seule, limitée au fournisseur connecté, ≤ 1 000 produits), `GET /api/supplier/catalog-health` (FOURNISSEUR), page `/dashboard/supplier/catalog-health`, lien depuis le tableau de bord.

Quatre classes, jamais mélangées :

| Classe | Règle | Diagnostics |
|---|---|---|
| Blocage | empêche réellement une opération aujourd'hui | prix manquant ; commission non explicite (une vente payée deviendrait une ligne non attribuée) ; épuisé (la fiche affiche « épuisé ») ; retiré par Affisell (rappel ou suspension — non corrigeable par le fournisseur) ; données de sécurité manquantes sur un brouillon **seulement si** `LISTING_READINESS_MODE=enforce` |
| Anomalie | donnée incohérente ou probablement fausse | stock nominal (99, 999, 9 999, 99 999) ; stock produit ≠ somme des déclinaisons ; stock des déclinaisons absent du tableau lu au paiement ; délai min > max ; doublon de nom chez le même fournisseur |
| Avertissement | risque, rien n'est bloqué | statut rappel/suspension illisible (jamais lu comme « aucun ») ; sécurité produit manquante hors `enforce` ; en pause alors que des revendeurs le proposent ; ≤ 3 unités ; aucune photo ; aucune catégorie ; aucun revendeur après 14 jours ; proposé mais aucune vente en 30 jours (dit « piste, pas constat ») |
| Recommandation | facultative, présentée comme telle | brouillon complet prêt à publier ; < 3 photos ; description < 200 caractères ; pas de GTIN |

- **Classement** : `classe × (1 + 3 × commandes payées 30 j + revendeurs qui le proposent)` — demande **constatée**, pas une prévision.
- **Chaque ligne** affiche sa source (fiche / constaté / règle Affisell / calcul) et les chiffres sur lesquels elle repose.
- **Correction directe** : quantité saisissable en ligne pour un produit simple (le `PATCH` fournisseur existant avec `stockBaseline` : aucune unité vendue entre-temps n'est ressuscitée) ; sinon lien vers la fiche.
- **Non fait, volontairement** : commission « sous la médiane de la catégorie » (comparer aux autres fournisseurs = donnée d'autrui, décision fondateur).

### Innovation 3 — Prochaine meilleure action (développée)

**Tâche supprimée** : se demander quoi faire en ouvrant son tableau de bord.

**Construit** : `lib/next-best-action/next-best-action.ts` (pur) + `.server.ts`, `GET /api/supplier/next-actions` et `GET /api/affiliate/next-actions` (chacun son rôle, lecture seule), carte `NextActionsCard` sur le tableau de bord fournisseur, la page santé et le catalogue revendeur.

- **Une à trois actions**, de types distincts, sur des produits distincts quand c'est possible. Chacune : action, justification (le code du diagnostic), données (avec leur qualification), **impact potentiel** (ce qui a été constaté sur ce produit en 30 jours — jamais garanti), priorité.
- **Fournisseur** : tirées de la santé du catalogue. Jamais une action qu'il ne peut pas faire (produit retenu par Affisell). Les améliorations facultatives ne deviennent une action que si le produit a de la demande — sinon c'est du bruit.
- **Revendeur** : 1) une fiche de sa boutique invendable (épuisé, retiré, en attente de validation, sans commission) ; 2) une alerte de rentabilité ouverte (module `profit-alerts`) ; 3) un produit prêt à vendre du copilote, avec son net réel par vente.
- **Aucune action automatique** : chaque carte ouvre l'écran existant.

## 3. Cohérence des trois moteurs

- **Catalogue fournisseur** : seule source des conditions (prix, commission, stock, publication). Le copilote les lit, il ne les modifie jamais.
- **Marketplace et transaction** : le calcul du net est la copie exacte du règlement, verrouillée par un test ; rien ne change dans le paiement ni dans les virements.
- **Approvisionnement** : non concerné. Le copilote ne propose jamais d'achat à une source externe.

## 4. Suivi

| Élément | Développé | Testé | Actif |
|---|---|---|---|
| Net réel par vente, cartes du catalogue corrigées | Oui | Oui (grille contre le règlement) | Non (branche, pas déployé) |
| Sélection prête à vendre + ajout groupé | Oui | Oui | Non |
| Décision A : ni prix ni quantité inventés à la publication (assistant Express) | Oui | Oui (unitaires) | Non |
| Décision B : « Fournisseur Affisell », plus d'e-mail fournisseur côté revendeur | Oui | Oui (unitaires + garde-fous de code) | Non |
| Santé du catalogue fournisseur | Oui | Oui (règles par classe, classement) | Non |
| Prochaine meilleure action (fournisseur et revendeur) | Oui | Oui | Non |

## 5. Décisions du fondateur (2026-11-19) et leur application

1. **F6 — identité fournisseur** : libellé = nom de boutique, sinon « Fournisseur Affisell » (`lib/supplier-public-label.ts`, aussi quand le nom de boutique est une adresse e-mail). L'e-mail n'est plus lu par la requête du catalogue revendeur ; les devis (demandes de produits) n'exposent plus ni l'e-mail ni le nom de la personne, seulement le nom de boutique chargé côté serveur. **Canal interne conservé** : la demande de produit et ses devis (messages tracés en base) ; aucun contact direct n'est montré par défaut.
2. **F4 — publication** : l'assistant Express refuse de publier sans prix et sans quantité saisis (`lib/product-availability.ts`). Modes réellement pris en charge : quantité disponible (produit physique) et « sans stock physique » (service, logiciel, abonnement, expérience). **Non pris en charge, listés comme tels** : sur commande, disponibilité permanente, précommande — aucun champ, la fiche affiche « épuisé » à 0 et le contrôle de stock refuserait. Les prendre en charge = stockage + paiement + fiche produit : décision fondateur.

### Décisions du 2026-11-19 (13 h) et leur application

3. **Imports 99 / 999 — corrigé à la source.** Chaque extracteur dit d'où vient sa quantité (`lib/import-stock.ts`). Lue chez la source (y compris 99 ou 999 réellement renvoyés) : conservée. Absente : stock 0, attribut « quantité à confirmer », brouillon jusqu'à confirmation par le fournisseur (en enregistrant une quantité) ou par un administrateur (`POST /api/admin/products/<id>/confirm-stock`, motif obligatoire, tracé). Concerne : import URL revendeur, import URL marketplace, Dropforge, import extension, enrôlement AliExpress admin, saisie admin, imports AliExpress fournisseur. Les produits existants ne sont pas modifiés. Le prix de repli 9,90 € de l'import revendeur est supprimé (import refusé comme incomplet).
4. **Démo séparée** : les produits `demo-lab` ne sont plus proposés aux acheteurs en production ni visibles des revendeurs réels.
5. **Sur commande / précommande — reporté** (feuille de route ci-dessous).
6. **Confidentialité des commissions** : aucune comparaison entre fournisseurs n'est développée.

## 6. Feuille de route — modes de disponibilité reportés (non implémentés)

| Mode | Ce qu'il faudrait | Implications |
|---|---|---|
| Sur commande | délai de fabrication par produit, stock « non géré » explicite, fiche « fabriqué à la commande » | le contrôle de stock (`CHECKOUT_STOCK_MODE`) ne doit pas refuser à 0 ; délai d'expédition SLA (`enforce-supplier-ship-sla`) à adapter ; droit de rétractation (bien personnalisé = exception légale à vérifier) |
| Disponibilité permanente | déclaration du fournisseur « illimité », jamais un grand nombre fictif | même contrôle de stock ; risque de survente porté par le fournisseur (contrat) |
| Précommande | date de mise à disposition, encaissement immédiat ou différé | paiement (encaissement avant expédition), virements différés, remboursement si date non tenue, affichage acheteur — chantier argent à valider avec l'expert-comptable |

## 7. Innovation 4 — retirer ou remplacer un produit invendable (développée, 2026-11-19)

**Tâche supprimée** : chercher à la main un produit équivalent quand un produit de sa boutique devient invendable.

Le revendeur ouvre l'action « Retirer ou remplacer » : le problème en une phrase, jusqu'à trois alternatives réellement équivalentes (même code-barres, ou même catégorie + nom très proche + options proposées), son gain net réel avant / après et les différences (prix, net, commission, délai, retours, options manquantes, marque), puis une confirmation explicite. Sans alternative fiable, l'écran le dit et propose seulement de retirer le produit. Rien n'est supprimé, aucune commande n'est modifiée. Détails techniques : `AGENTS.md` (« Reseller — withdraw or replace »).


## 8. Avis « produit invendable » — mesures en observation (mode `observe`, inchangé)

**Statut** : développé et testé (CI). **Réellement actif : non** — aucune exécution de production observée à ce jour (hébergement suspendu, aucune donnée réelle lue). Le passage à `enforce` reste une décision du fondateur.

Chaque exécution quotidienne en `observe` n'envoie rien et enregistre :

- un marqueur interne par couple (fiche, problème, fenêtre de 14 jours) — distinct de la vraie réservation d'avis, donc l'observation ne « consomme » aucun futur avis ; le nombre de marqueurs **créés** un jour donné = le nombre exact de notifications que `enforce` aurait envoyées ce jour-là ;
- un agrégat du jour (comptages seulement, aucun identifiant de revendeur, de fiche ou de produit).

Lecture : `GET /api/admin/reseller-unsellable-observations?days=30` (administrateur, lecture seule).

| Indicateur | Ce qu'il dit | Qualification |
|---|---|---|
| `unsellable`, `unsellableShare` | fiches en ligne qu'un acheteur ne peut pas acheter, et leur part | constaté |
| `byProblem` | rupture / produit indisponible / en attente de validation / commission absente | constaté |
| `resellersAffected`, `resellersWithMany`, `maxPerReseller` | combien de revendeurs seraient prévenus, et si certains recevraient beaucoup d'avis le même jour | constaté |
| `wouldNotifyNew` | avis que `enforce` aurait envoyés ce jour (déduplication de 14 jours incluse) | mesuré (simulation exacte de la règle) |
| `wouldSkipPreference` | parmi eux, ceux que la préférence « alertes dans l'application » du revendeur aurait bloqués | constaté |
| `truncated` | le scan a atteint 5 000 fiches : les chiffres sont un minimum | — |

Critères proposés (à valider) avant de demander `enforce` : au moins 7 jours d'observation (`reading: "observed"`) ; un pic `peakWouldNotifyNew` compatible avec le support ; `resellersWithMany` examiné (un revendeur à 20 avis le même jour appellerait un regroupement en un seul avis) ; aucun jour `truncated`. Ces seuils sont des propositions, pas des décisions.

## 9. Fournisseur — impact d'un problème de disponibilité chez les revendeurs (développé, 2026-11-19)

**Statut** : développé, tests écrits (CI). Réellement actif : non (aucun déploiement).

En haut de « Santé du catalogue », une section « Disponibilité chez vos revendeurs » répond en une lecture à trois questions :

1. **Combien ça coûte ?** — pour chaque produit présent dans au moins une boutique de revendeur et touché par un problème de disponibilité : nombre de boutiques où il est invendable (ou à risque), commandes payées, unités et montant fournisseur des 30 derniers jours, date de la dernière vente. Tout est **constaté** (commandes payées, avant remboursements) ; aucune perte n'est prévue ni promise.
2. **Pourquoi ?** — la cause en une phrase, reprise du diagnostic de santé (une seule définition), plus les autres problèmes du même produit.
3. **Comment corriger ?** — sur place : quantité réelle (produit simple), « Remettre en vente » (lève la pause du fournisseur lui-même par la route existante, qui refuse toujours un rappel, une suspension Affisell ou une quantité non confirmée et le dit en mots), ouverture de la fiche (déclinaisons), ou explication d'un retrait Affisell (aucune action proposée que le fournisseur ne peut pas faire).

Ordre : invendable avant « à risque », puis ce que le produit faisait réellement (commandes, montant), puis le nombre de boutiques. Lecture seule ; aucun chiffre d'un autre fournisseur.
