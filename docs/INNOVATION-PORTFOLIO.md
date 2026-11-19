# Portefeuille d'innovations Affisell — évaluation et priorités

Mis à jour le 19 novembre 2026. Document vivant : chaque idée est évaluée avant d'être construite, et retirée si elle n'apporte pas de valeur mesurable.

**Méthode.** Pour chaque idée : le problème réel (constaté dans le code ou les flux, pas supposé), la valeur pour le fournisseur, le revendeur et Affisell, la faisabilité avec les données réellement disponibles, le coût, les risques, puis une priorité. Une idée n'est construite d'office que si elle est **réversible** (aucune migration, aucun argent, aucun envoi externe, lecture seule ou interrupteur à `off`/`observe`). Le reste attend une décision.

Échelles : valeur et effort de 1 (faible) à 3 (fort). Priorité = valeur élevée et effort faible d'abord.

## Construit

| # | Innovation | Problème résolu | Statut |
|---|---|---|---|
| 1 | Revenu net réel par vente (revendeur) | Le catalogue affichait le brut, pas ce que le revendeur touche | Développé, testé |
| 2 | Santé du catalogue + prochaine meilleure action | Le fournisseur ne savait pas ce qui l'empêchait de vendre | Développé, testé |
| 3 | Retirer ou remplacer un produit invendable | Le revendeur découvrait seul un produit épuisé dans sa boutique | Développé, testé (avis en `observe`) |
| 4 | Impact d'un problème de disponibilité chez les revendeurs | Le fournisseur ignorait combien de boutiques et de ventes étaient touchées | Développé, testé |
| 6 | **Tendance Affisell dans la sélection du copilote** (priorité A) | Le revendeur choisissait sans voir ce qui accélère | Développé, tests écrits |
| 7 | **Avis invendable quotidien** (un seul avis par revendeur et par jour, liste dédiée) | Un revendeur avec plusieurs produits invendables aurait reçu une notification par produit | Développé, tests écrits (mode `observe` inchangé) |
| 8 | **Calcul de réassort explicable** (stock déclaré / confirmé / réservé, délai déclaré) | Le fournisseur devait calculer seul combien remettre | Développé, tests écrits (jamais prérempli ni appliqué) |
| 9 | **Copilote personnalisé par catégories** (borné par la rentabilité, part de découverte) | Sélection identique pour tous | Développé, tests écrits |
| 10 | **Opportunités offre ↔ demande** (administration) | Affisell ne voyait pas où recruter fournisseurs ou revendeurs | Développé, tests écrits (interne) |
| 11 | **Alerte fournisseur « demande bloquée »** (commandes constatées, paiements sans commande, estimation à part, un avis par jour, préférences) | Un fournisseur découvrait tard que ses revendeurs ne pouvaient plus vendre son produit | Développé, tests écrits (mode `observe`) |
| 12 | **Opportunités ↔ journal de décisions** (fournisseurs vendables, produits vendables, part distribuée — corrélation, jamais attribution) | Impossible de mesurer l'effet d'une décision de recrutement | Développé, tests écrits |
| 13 | **Anticipation des ruptures** (déclaré / confirmé / disponible / rythme / couverture / délai, hypothèses et limites affichées, alerte préventive dans l'avis quotidien) | Le fournisseur apprenait la rupture quand ses revendeurs ne pouvaient déjà plus vendre | Développé, tests écrits (mode `observe`) |
| 14 | **Confirmation de stock datée en un clic** (« cette quantité est juste », jamais de modification) | Aucune date de confirmation du stock n'existait : impossible de juger la fraîcheur | Développé, tests écrits |
| 15 | **Stock par déclinaison et ruptures partielles** (ventes constatées par taille / couleur, jamais de répartition du total, revendeurs comptés à partir de 2) | Un total suffisant masquait une taille épuisée | Développé, tests écrits (lecture seule) |
| 16 | **Ruptures par déclinaison dans l'avis quotidien** (déclinaison vendue puis épuisée, ou à risque avant le délai ; ce qui reste en vente ; même avis unique par jour ; jamais deux fois la même situation) | Le fournisseur ne voyait la rupture d'une taille qu'en ouvrant la page | Développé, tests écrits (mode `observe`) |
| 17 | **Déclinaison inexistante refusée avant paiement** (même règle que la déduction du stock ; options encore en vente proposées, rien n'est remplacé) | Une taille ou couleur inexistante passait tous les contrôles et était payée sans rien déduire | Développé, tests écrits (journalisé seulement tant que `CHECKOUT_STOCK_MODE` n'est pas `enforce`) |
| 18 | **Tailles épuisées affichées sur la fiche marketplace** (ordinateur et mobile, comme la boutique revendeur) | L'acheteur découvrait la rupture d'une taille au moment de payer | Développé (affichage, sans test de rendu) |
| 19 | **Une règle unique pour la déclinaison achetée** (couleur, taille, capacité ; couleur sans taille = sélection incomplète ; jamais de taille choisie à la place de l'acheteur ; capacité transmise jusqu'à la commande) | Une couleur seule ou un téléphone sans capacité passait sans qu'aucune ligne de stock ne soit identifiée ; une capacité pouvait être refusée à tort | Développé, tests écrits (contrôle en `warn`) |
| 20 | **Cartes et assistant : « choisissez sur la fiche »** au lieu d'un achat sans taille | Un achat depuis une carte créait une commande sans taille ni couleur | Développé, tests écrits (actif dans tous les modes : c'est un choix manquant, pas un refus de stock) |
| 21 | **Commandes payées non expédiées lues des deux façons** dans le rapport de stock | Impossible de savoir combien d'unités affichées sont déjà vendues tant que rien n'est déduit au paiement | Développé, tests écrits (lecture seule) |
| 22 | **Santé du catalogue : déclinaisons impossibles à distinguer** | Des lignes identiques ne sont jamais déduites ni achetables précisément, sans que le fournisseur le sache | Développé, tests écrits |
| 5 | **Couverture de stock** (ce cycle) | La rupture n'était signalée qu'à 3 unités, trop tard pour réassortir avant que les boutiques ne bloquent | Développé, tests écrits |

**Couverture de stock — détail.** Problème : un produit qui se vend 30 fois par mois et qui a 10 unités sera épuisé dans environ 10 jours ; l'alerte existante (« ≤ 3 unités ») arrive quand il est déjà trop tard pour réassortir, et chaque boutique de revendeur devient invendable. Règle : au rythme des 30 derniers jours, si le stock restant couvre moins de 14 jours, avertissement « Rupture proche au rythme actuel ». Jugé seulement avec au moins 5 unités vendues en 30 jours (en dessous, une commande déplace trop le rythme). C'est un **calcul étiqueté comme tel**, jamais une prévision ni une promesse. Le message est affiché dans la santé du catalogue, l'impact chez les revendeurs (« à risque ») et la prochaine meilleure action, avec la correction sur place (quantité). Lecture seule, aucune donnée nouvelle.

## Évaluées, priorisées

| # | Idée | Problème réel | Valeur F / R / A | Faisabilité (données disponibles) | Effort | Risques | Priorité |
|---|---|---|---|---|---|---|---|
| A | **Tendance Affisell dans la sélection du copilote revendeur** : signaler les produits dont les commandes accélèrent sur la marketplace | Le revendeur choisit sur la demande des 30 derniers jours, sans voir ce qui monte | 2 / 3 / 2 | Oui : le détecteur interne « produits émergents » (test statistique contre la croissance de la marketplace) existe ; il suffit d'en exposer un résultat agrégé, sans identifier aucun revendeur ni fournisseur | 1 | Effet de troupeau ; un produit porté par un seul revendeur peut refléter sa propre campagne (à exclure, comme en interne) | Fait (n° 6) |
| B | Avis invendable regroupé en un seul message par revendeur et par jour | Un revendeur avec 20 fiches touchées recevrait 20 notifications | 1 / 2 / 1 | Oui (mesures en observation déjà en place) | 1 | Aucun tant que le mode reste `observe` | 2 |
| C | Réassort en un clic depuis l'alerte de couverture (quantité suggérée = 30 jours de ventes) | Le fournisseur doit calculer seul combien remettre | 2 / 1 / 1 | Oui, mais une quantité suggérée ressemble à une recommandation d'achat : à formuler comme calcul, jamais pré-remplie | 1 | Prise pour un engagement ; à valider sur la forme | 3 |
| D | Fiche produit assistée par IA (titre, description, caractéristiques) à partir des photos et de l'URL source | Les fiches courtes ou sans caractéristiques vendent moins (recommandations « description courte », « sans GTIN ») | 3 / 2 / 2 | Partielle : routes IA réservées existent (`fill-specs`), coût par appel ; aucune mesure encore de l'effet d'une meilleure fiche sur les ventes | 2 | Coût d'inférence ; texte inexact présenté comme vrai (règles GPSR) ; doit rester une proposition que le fournisseur valide | 4 — après mesure |
| E | Score « prêt à vendre » publié aux revendeurs (fiabilité fournisseur) | Le revendeur ne sait pas quel fournisseur expédie bien | 2 / 3 / 2 | L'indice interne existe mais **sa publication est une décision du fondateur** | 1 | Juridique et relationnel avec les fournisseurs | En attente de décision |
| F | Personnalisation : recommandations du copilote selon les catégories que le revendeur vend déjà | La sélection est la même pour tous les revendeurs | 2 / 2 / 2 | Oui : ventes propres du revendeur par catégorie ; pas besoin de données comportementales (consentement analytique non requis) | 2 | Enfermer le revendeur dans ses catégories ; garder une part « découverte » | 5 |
| H | **Avertir l'acheteur au retour d'une taille** (« prévenez-moi ») | Un acheteur qui ne trouve pas sa taille part | 2 / 2 / 2 | Partielle : les alertes de prix Web Push existent ; **aucune date de réassort n'est enregistrée**, donc jamais de date promise — seulement « dès qu'elle revient » | 2 | Consentement de notification ; ne rien promettre | 6 |
| I | Alternatives dans la boutique d'un revendeur quand une taille manque (ses propres produits seulement) | La marketplace propose des produits similaires, la boutique revendeur non | 2 / 2 / 1 | Oui (catalogue du revendeur, équivalence « identique / similaire » déjà écrite pour le remplacement) | 2 | Ne jamais remplacer le choix de l'acheteur ; respecter la rentabilité du revendeur | 7 |
| G | Indicateurs externes de demande (Wikipédia) | Anticiper la demande avant les ventes | 2 / 2 / 2 | Candidat déjà outillé, **non prouvé** : l'évaluation sur données réelles n'a pas été faite | — | Fausse corrélation | Bloqué tant que l'évaluation n'a pas montré une valeur prédictive |

## Écartées (pour l'instant)

- **Comparaison des commissions entre fournisseurs** : contraire à la règle de confidentialité des commissions (seuls des indicateurs agrégés et anonymisés, sur autorisation).
- **Prix recommandé aux revendeurs à partir de l'élasticité** : décision du fondateur (18 novembre) — usage interne uniquement.
- **Achat automatique piloté par l'IA** : l'achat externe reste fermé par l'interrupteur unique ; hors priorité (le catalogue fournisseur passe d'abord).

## Mesure de la valeur

Chaque innovation construite doit pouvoir être jugée sur des faits observables après activation, par exemple :
- couverture de stock : part des produits signalés qui sont réassortis avant d'atteindre 0, et nombre de jours-boutique invendables évités (comparaison avant / après, observation et non preuve causale) ;
- remplacement : part des fiches invendables retirées ou remplacées dans les 7 jours ;
- impact disponibilité : délai entre l'apparition d'un problème et sa correction par le fournisseur.

Ces mesures ne sont pas encore câblées : elles le seront avec la première activation réelle.
