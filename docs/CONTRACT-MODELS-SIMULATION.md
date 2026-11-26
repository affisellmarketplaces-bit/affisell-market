# Modèles contractuels B, C1, C2 — méthode de simulation et de comparaison

Préparé le 19 novembre 2026. **Simulation uniquement** : aucun taux n'est choisi, aucune commande n'est modifiée,
aucun fournisseur n'est rattaché à un modèle. Consultation : `GET /api/admin/contract-models/simulation?days=90`
(administrateur, lecture seule), une fois la branche disponible sur un environnement.

## Ce que la simulation lit

| Nature | Contenu | Origine |
|---|---|---|
| **Données réelles enregistrées** | Prix de vente HT, prix fournisseur, commission revendeur, frais fournisseur figés, coût AliExpress (commandes en achat automatique uniquement) | Commandes payées de la période |
| **Données manquantes** | Coût d'achat à la source d'une commande catalogue ; frais fournisseur non figés sur les commandes anciennes | Signalées ; un modèle qui en a besoin n'est **pas calculé** pour cette commande |
| **Hypothèses** | Valeurs provisoires des paramètres non décidés ; taux de frais par défaut quand la commande n'en porte pas ; frais Stripe estimés (2,9 % + 0,25 €) ; volume inchangé quel que soit le modèle | Écrites sur chaque résultat |
| **Résultats calculés** | Part du fournisseur, du revendeur, d'Affisell avant et après frais Stripe estimés, trésorerie avancée par Affisell | Formule unique `splitLine`, qui conserve l'argent |
| **Risques économiques** | Affisell à perte, part fournisseur négative, avance non couverte (C2), trésorerie avancée (B, C2) | Déduits du calcul, jamais masqués |

## Trois vues complémentaires

1. **Totaux par modèle** : A sur toutes les commandes exploitables ; B, C1, C2 seulement sur les commandes dont le coût
   d'achat est enregistré. Les commandes remboursées ou en litige sont comptées à part et exclues.
2. **Balayage des taux non décidés** (0 à 30 %) : pour chaque taux, la part de chacun et trois seuils (Affisell cesse
   de perdre au total, plus aucune commande à perte, dernier taux sans part fournisseur négative). C'est une plage à
   examiner, pas une proposition.
3. **Commandes représentatives** : les commandes sont réparties en trois tranches de prix (basse, moyenne, haute) et,
   dans chaque tranche, on retient la **commande réelle** la plus proche du prix médian, jamais une moyenne qui
   mélangerait des coûts qui n'ont pas existé ensemble. Les quatre modèles y sont posés côte à côte, avec, pour chacun,
   ce qui est enregistré, ce qui manque, les hypothèses, le calcul et les risques.

## Limites connues

- Les coûts d'achat réels connus sont ceux d'AliExpress en achat automatique. Pour un fournisseur catalogue, aucun coût
  source n'existe dans les données : B et C ne peuvent pas être évalués sur ses commandes sans qu'il le fournisse.
- Les frais Stripe et le montant réellement débité sur la carte d'achat sont des estimations tant qu'ils ne sont pas
  enregistrés (voir `report:fee-reconciliation`).
- Le volume est supposé inchangé : un modèle qui modifie le prix payé par l'acheteur n'est pas évalué ici.

## Décisions qui reviennent au fondateur

Les valeurs de `resellerFeeBps` (B), `procurementServiceFeeBps` (C1, C2), le plafond et la garantie d'avance (C2), le
propriétaire et le fournisseur contractuel (B, C2), puis le rattachement d'un fournisseur à un modèle validé (migration).

## Coûts déclarés par les fournisseurs du catalogue (ajouté le 19 novembre)

Pour qu'un modèle B ou C puisse un jour être évalué sur les commandes d'un fournisseur du catalogue, ce fournisseur
peut désormais **déclarer** ses coûts d'approvisionnement, produit par produit, dans le formulaire de sa fiche (section
« Coûts d'approvisionnement (confidentiel) », visible une fois le produit enregistré) :

- coût d'achat ou de fabrication d'une unité, coût de livraison jusqu'à l'acheteur, provenance, délai, quantité minimale ;
- **distinct** du prix fournisseur, du prix de vente, de la commission et des frais Affisell : enregistrer ces coûts ne
  modifie rien sur la fiche ni sur l'offre ;
- **confidentiel** : lisible par le fournisseur propriétaire du produit et par l'administration Affisell seulement ;
- **historisé** : chaque déclaration est conservée ; une commande n'est simulée qu'avec la déclaration en vigueur à son
  paiement, jamais avec une déclaration postérieure ;
- **non vérifié** : dans la simulation, ces commandes forment un groupe à part (« coûts déclarés »), jamais mélangé avec
  les achats réellement enregistrés, et chaque résultat porte l'hypothèse « coût déclaré par le fournisseur, non vérifié ».

Stockage sans migration (journal d'audit). Inviter les fournisseurs à déclarer leurs coûts, et décider si une
déclaration doit un jour être vérifiée (facture, contrôle), relèvent du fondateur.

## Qualification des déclarations et comparaison avec les coûts constatés (19 novembre)

- Cinq statuts, jamais attribués automatiquement : non vérifiée, justificatif annoncé (par le fournisseur), vérifiée,
  contestée, expirée (par Affisell, motif obligatoire). Chaque statut vise une version précise de la déclaration.
- Dans les simulations, chaque coût déclaré porte son statut. Tant qu'il n'est pas vérifié, il porte aussi la mention
  « ne peut fonder aucun taux, engagement ou automatisme commercial ». Contesté ou expiré : résultat signalé non fiable.
- Comparaison déclaré / constaté (page produit de l'administration) : coût unitaire déclaré en vigueur au paiement
  contre coût unitaire enregistré par Affisell sur ses commandes en achat automatique du même produit. Le coût
  « constaté » est aujourd'hui le prix d'achat mémorisé par Affisell, pas le montant réellement débité ; le
  rapprochement avec le montant réel reste à construire (décision déjà notée : enregistrer le montant débité).
