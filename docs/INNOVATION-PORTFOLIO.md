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
