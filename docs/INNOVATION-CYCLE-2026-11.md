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

### Innovation 2 — Copilote fournisseur : santé du catalogue (prochaine)

**Tâches supprimées** : chercher produit par produit ce qui bloque, ou rend douteuses, les ventes.

**Conception** : un seul écran qui passe tout le catalogue du fournisseur en revue (F4, F5).

- **Ce qui empêche de vendre** :
  - absence de commission explicite ;
  - rupture de stock alors que des revendeurs listent le produit ;
  - données de sécurité produit manquantes, si le mode `enforce` est activé ;
  - suspension ou rappel par Affisell (« bloqué », pas une tâche du fournisseur).
- **Ce qui rend les données douteuses** :
  - stock « rond » jamais modifié (99, 999) ;
  - prix par défaut ;
  - absence de photo ou de GTIN ;
  - doublons chez le même fournisseur.
- **Ce qui freine la commercialisation** :
  - aucun revendeur ne le liste ;
  - commission nettement sous la médiane de sa catégorie (chiffre observé).
- **Tri par impact commercial observé** : ventes payées sur 30 jours, revendeurs qui listent le produit.
- **Action** : chaque ligne ouvre le bon champ du formulaire existant.

Les briques existantes sont réutilisées : `evaluateListingReadiness`, `checkSupplierMayActivate`, `product-journey`, `duplicate-check`.

### Innovation 3 — Assistant contextuel : la prochaine meilleure action

**Tâche supprimée** : se demander quoi faire en ouvrant son tableau de bord.

**Conception** : une ou trois actions maximum, déduites de la situation réelle et sans aucune action automatique.

- **Côté fournisseur** : le premier point de la santé du catalogue.
- **Côté revendeur**, par ordre de priorité :
  1. une alerte de rentabilité active (le module existant `profit-alerts`) ;
  2. une fiche de sa boutique devenue invendable (rupture, retrait) ;
  3. sinon, la sélection du copilote.
- **Chaque action** dit pourquoi elle est proposée et sur quelle donnée elle repose.

## 3. Cohérence des trois moteurs

- **Catalogue fournisseur** : seule source des conditions (prix, commission, stock, publication). Le copilote les lit, il ne les modifie jamais.
- **Marketplace et transaction** : le calcul du net est la copie exacte du règlement, verrouillée par un test ; rien ne change dans le paiement ni dans les virements.
- **Approvisionnement** : non concerné. Le copilote ne propose jamais d'achat à une source externe.

## 4. Suivi

| Élément | Développé | Testé | Actif |
|---|---|---|---|
| Net réel par vente, cartes du catalogue corrigées | Oui | Oui (grille contre le règlement) | Non (branche, pas déployé) |
| Sélection prête à vendre + ajout groupé | Oui | Oui | Non |
| Santé du catalogue fournisseur | Conception (§ 2) | — | — |
| Prochaine meilleure action | Conception (§ 2) | — | — |

## 5. Points soumis au fondateur

1. **F6** : afficher l'e-mail du fournisseur aux revendeurs, ou un libellé neutre ?
2. **F4** : faut-il refuser la publication par l'assistant v2 sans prix ni stock saisis, au lieu de 10 € et 99 unités ? Je le recommande.
