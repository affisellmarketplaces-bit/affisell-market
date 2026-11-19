# Registre des coûts réellement constatés — conception (19 novembre 2026)

**Conception et logique testée uniquement.** Aucun stockage nouveau, aucune migration, aucun flux financier modifié,
aucune opération réelle. Code : `lib/supplier-costs/observed-cost-register.ts` (pur).

## Quatre natures d'écriture, jamais additionnées entre elles

| Nature | Ce que c'est | Source possible | Fiabilité |
|---|---|---|---|
| Prix mémorisé à la source | Le prix qu'Affisell a retenu (lien AliExpress), figé sur la commande | Instantané de commande | Estimé : ce n'est pas de l'argent qui a bougé |
| Montant effectivement débité | Ce qui a réellement été payé pour l'achat | Capture de la carte d'achat, facture payée | Constaté (lu à la source), jamais estimé |
| Frais associés | Frais de carte, de change, douane, frais de plateforme | Rapprochement, saisie administrateur | Constaté ou incertain |
| Justificatif | Document qui appuie une écriture (n° de facture, fiche de commande) — sans montant, sans fichier | Saisie administrateur ou fournisseur | — |

La validation refuse notamment : un instantané de commande présenté comme un débit, un débit « estimé », un justificatif
qui porterait un montant, une devise inconnue.

## Le périmètre de chaque montant

Chaque montant indique ce qu'il couvre : devise, unité ou ligne entière, livraison incluse ou non, TVA exclue, incluse
ou inconnue, variante. Deux montants ne sont comparés que si leurs périmètres sont identiques **et entièrement connus**.
Sinon la comparaison n'est pas faite, et la raison est affichée (« traitement de la TVA inconnu », « variantes
différentes ou non précisées »…).

Conséquence assumée aujourd'hui : le prix mémorisé AliExpress a une TVA inconnue, donc **aucune comparaison
déclaré / constaté n'est calculée sur ces commandes** ; elles apparaissent avec leur raison. Les déclarations des
fournisseurs couvrent le produit entier (pas une variante) : une commande d'une variante précise n'est pas comparable
non plus. Une déclaration par variante est une évolution possible.

## Pour passer au stockage (décisions du fondateur)

1. Une table dédiée `ObservedCostEntry` (migration) — ou l'alimentation par le rapport de rapprochement des frais,
   exécuté avec une clé en lecture seule.
2. Enregistrer, au moment de l'achat, le montant réellement débité sur la carte (flux financier : à valider).
3. Qui peut saisir un montant ou un justificatif (administrateur seulement, recommandé).
