# Changer de fournisseur : où la marge réelle d'Affisell gagnerait le plus (2026-11-18)

Code : `lib/strategic-intelligence/sourcing-opportunities.ts` (calcul, sans accès aux données) et `sourcing-opportunities.server.ts` (lecture seule).
Cockpit `/admin/intelligence`, section « Changer de fournisseur ».
Usage **interne** uniquement :
- aucun score de fournisseur n'est publié ;
- aucun fournisseur n'est changé ;
- rien n'est acheté et aucun engagement n'est pris.

Un test vérifie que seule la page admin lit ce module.

## Ce qu'est un changement de fournisseur sur Affisell

L'annonce d'un revendeur pointe vers **un** produit fournisseur. Changer de fournisseur signifie que le revendeur référence le produit d'un autre fournisseur portant **le même code-barres GS1 valide**. C'est la seule preuve d'identité retenue : les noms ne sont jamais comparés.

Affisell ne peut pas faire ce changement seule. La marge du revendeur après le changement fait donc partie de la faisabilité : si elle baisse de plus de 10 %, il n'a aucun intérêt à changer sans contrepartie.

## Calcul

On applique la répartition du règlement (`unitOutcome`, la même que pour la simulation des leviers) à la **commande moyenne mûre** du produit, une fois avec le fournisseur actuel, une fois avec l'alternative. Pour l'alternative, on prend :
- son prix catalogue ;
- sa commission revendeur explicite ;
- son canal :
  - **catalogue** : le fournisseur expédie lui-même, Affisell ne paie aucun coût AliExpress ;
  - **achat automatique** : Affisell paie le coût AliExpress enregistré sur le lien (prix + port ; une valeur à 0 signifie « inconnu ») ;
- son taux de frais Affisell :
  1. le taux négocié s'il est enregistré pour ce fournisseur ;
  2. sinon le taux observé sur le produit actuel, si le canal est le même ;
  3. sinon le taux par défaut du canal.

Le prix de vente du revendeur est conservé, donc le prix payé par l'acheteur ne change pas. Garder le même nombre de commandes est alors cohérent avec le modèle de prix. La qualité et les délais pourraient malgré tout modifier ce nombre ; ce point n'est pas modélisé, et c'est indiqué.

**Constat structurel** : Affisell gagne des frais, pas le prix.
- Un fournisseur catalogue moins cher ne change la marge d'Affisell que par les frais : l'effet est faible, et l'essentiel de l'écart va à la marge du revendeur.
- L'effet majeur vient d'un produit en **achat automatique** où Affisell paie AliExpress, remplacé par une offre **catalogue** au même code-barres : le coût AliExpress disparaît pour Affisell.

## Trois niveaux, jamais mélangés

- **Observé** :
  - les commandes mûres et la marge du produit actuel (avec sa part constatée) ;
  - ses commandes sur 30 jours ;
  - pour l'alternative : prix catalogue, stock, commission, canal, délais p90 attestés par le transporteur, verdicts de l'indice interne de fiabilité, et ses propres ventes sur Affisell quand il y en a.
- **Estimé** : la variation de la marge d'Affisell, par commande et sur 30 jours (volume conservé), ainsi que la variation pour le revendeur.
- **Hypothèses** (listées une par une) :
  - le prix de vente du revendeur est conservé ;
  - le volume est conservé ;
  - le prix catalogue de l'alternative est celui qui serait réellement payé ;
  - le taux de frais, s'il n'est pas négocié ;
  - le taux de remboursement, si l'alternative n'a jamais été vendue sur Affisell.

## Faisabilité, qualité, confiance

- **Bloquée** :
  - commission revendeur non explicite (le produit ne peut pas être vendu) ;
  - coût AliExpress inconnu ;
  - fournisseur alternatif classé « à risque » ;
  - prix fournisseur supérieur ou égal au prix de vente du revendeur.
- **À vérifier** :
  - stock à 0 (cela peut aussi signifier un stock non suivi) ;
  - fiabilité du fournisseur non mesurée ;
  - qualité moins bonne ;
  - revendeur perdant plus de 10 % de sa marge.
- **Qualité** :
  - « meilleure » quand le produit actuel a trop de problèmes et que l'alternative est mieux notée ;
  - « moins bonne » quand l'alternative est classée « à risque », est moins bien notée, ou rembourse nettement plus (5 points ou davantage) ;
  - « inconnue » quand il n'y a aucune donnée.
- **Confiance** :
  - « moyenne » uniquement sans donnée manquante, avec au plus quatre hypothèses et au moins 80 % de marge constatée ;
  - « basse » sinon.

## Priorités

Ordre de classement :
1. faisabilité ;
2. fiabilité du modèle (un écart de plus de 0,50 € par commande entre le modèle et la marge constatée rend l'estimation indicative) ;
3. gain mensuel estimé pour Affisell.

Une offre ne compte comme opportunité que si elle rapporte au moins 20 € sur 30 jours, ou si elle améliore la qualité sans réduire la marge d'Affisell.

Le signal `commercial:sourcing:<produit>` est « important » seulement s'il est réalisable, de confiance moyenne, et rapporte au moins 50 € sur 30 jours. Une décision prise depuis ce signal est **mesurée** sur la marge d'Affisell par commande mûre (`affisell_net_cents_per_order`), comme pour les autres décisions de marge : il s'agit d'une évolution observée, pas d'une preuve de causalité.

## Limites

- Seuls les produits à code-barres valide peuvent être comparés. Le cockpit compte les produits « à problème » sans code-barres.
- Le prix catalogue n'est pas un prix négocié, et les conditions réelles (minimum de commande, délais de démarrage) ne sont pas connues.
- La comparaison est plafonnée à 500 produits et 5 000 offres. Au-delà, le calcul est refusé plutôt que de produire un classement faux.
- Le vrai coût AliExpress payé et les vrais frais Stripe ne sont toujours pas enregistrés : chaque marge Affisell repose encore sur ces deux estimations (`report:fee-reconciliation`).
