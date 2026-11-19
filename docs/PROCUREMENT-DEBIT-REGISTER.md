# Registre des débits d'achat et coûts par variante

Rédigé le 19 novembre 2026. Décisions validées par le fondateur le 19 novembre 2026 : enregistrer les montants réellement débités lors des achats et permettre une déclaration de coûts par variante.

**État** : développé et testé (tests unitaires, plus base PostgreSQL de test). La migration n'est **appliquée nulle part** : ni en production ni sur la branche de préproduction. Le registre et les coûts par variante n'ont jamais servi sur des données réelles, et aucun flux financier n'a été modifié.

## 1. Trois montants à ne jamais confondre

| Montant | Ce que c'est | Où il vit | Peut-il valoir coût réel ? |
|---|---|---|---|
| Prix mémorisé | Prix de la source qu'Affisell a retenu (`Order.aeWholesaleCents` = prix unitaire × quantité, livraison exclue, TVA inconnue) | Commande | **Jamais.** C'est un enregistrement d'Affisell, aucun argent n'a bougé. |
| Montant débité | Ce qui a réellement quitté le compte pour la marchandise : débits − remboursements rapprochés, en **euros réglés** | `ProcurementDebit` + `ProcurementDebitAllocation` | Oui, mais seulement pour une commande **entièrement rapprochée**. |
| Coût complet | Montant débité + frais rapprochés (carte, change, douane…) | Idem | Même condition. |

Tant qu'une commande n'est pas entièrement rapprochée, ses montants restent affichés comme **provisoires**. Les raisons sont listées, et ni la simulation ni la comparaison ne reçoivent ces chiffres comme un coût.

## 2. Modèle

**Mouvement** (`ProcurementDebit`). Chaque mouvement est lu à sa source, puis saisi par un administrateur. Il comprend :

- **Nature** : `debit`, `refund` (rattaché obligatoirement au débit qu'il rembourse) ou `fee` (frais, rattachés à un débit ou isolés).
- **Source** : `stripe_issuing`, `card_statement`, `bank_statement` ou `supplier_invoice_paid`.
- **Référence de transaction** : unique par source. Une même transaction ne peut donc pas être enregistrée deux fois.
- **Montant et devise d'origine**, plus le **montant réglé en euros**. En euros, les deux sont identiques ; dans une autre devise, le montant réglé est saisi tel qu'il figure au relevé. Aucun taux n'est inventé : le taux implicite est affiché à titre d'information.
- **Date.**
- **Périmètre** : livraison incluse ou non, TVA incluse, hors TVA ou inconnue.
- **Justificatifs** : type, référence, description. Ils sont obligatoires pour une saisie depuis un relevé ou une facture.
- **Note**, auteur et date de saisie.

Un mouvement n'est jamais supprimé. On l'annule avec un motif, ce qui révoque aussi ses rapprochements. L'annulation est refusée tant qu'un remboursement ou des frais encore actifs pointent vers ce mouvement.

**Rapprochement** (`ProcurementDebitAllocation`). Un rapprochement attribue tout ou partie d'un mouvement à **une** commande, en euros réglés. Son motif est l'un des suivants : `single_order`, `grouped_split` (achat groupé), `partial_payment` (commande payée en plusieurs fois) ou `manual` (justification obligatoire). Un rapprochement n'est jamais supprimé : on le révoque avec un motif.

## 3. Cas gérés

- **Achat groupé** : un débit est réparti entre plusieurs commandes. Tant qu'une partie du débit n'est pas attribuée, aucune de ces commandes n'a de coût réel, car la part de chacune n'est pas établie.
- **Débits partiels** : une commande payée par plusieurs débits reçoit un rapprochement pour chacun.
- **Remboursements** : un remboursement n'est attribuable qu'à une commande déjà couverte par son débit. Le total remboursé à cette commande ne peut pas dépasser sa part du débit, en comptant tous les remboursements du même débit. Un remboursement du débit qui n'est pas encore réparti rend le coût des commandes concernées provisoire.
- **Frais** : comptés à part, puis additionnés au coût complet. Des frais rattachés à un débit et non répartis rendent eux aussi le coût provisoire.
- **Écarts de change** : seuls les euros réglés comptent. Les devises d'origine et les taux implicites sont affichés.
- **Écart au prix mémorisé** : coût complet − prix mémorisé, calculé uniquement pour une commande entièrement rapprochée.

## 4. Pas de double comptage

Le code applique ces règles et la base les vérifie de nouveau :

1. Une référence n'existe qu'une fois par source (index unique).
2. Un mouvement n'a qu'un seul rapprochement actif par commande (index unique partiel).
3. Le total des rapprochements actifs d'un mouvement ne dépasse jamais son montant réglé. Un déclencheur verrouille la ligne du mouvement, ce qui bloque aussi les écritures concurrentes et une insertion SQL directe. Le cas a été vérifié sur une base PostgreSQL 16 locale de test : de deux rapprochements concurrents, un seul passe.
4. Un mouvement sans montant réglé en euros n'est pas rapprochable.
5. Un mouvement annulé n'entre plus dans aucun calcul.

## 5. Coûts déclarés par variante

- **Une seule identité de variante** (`lib/supplier-costs/variant-key.ts`) : les valeurs d'option normalisées, couleur puis taille. Cette clé fait se correspondre trois écritures :
  - le libellé de la commande (« Noir · M ») ;
  - le nom de la ligne SKU (« Noir / M ») ;
  - la table des variantes (couleur, taille).
- **Rien n'est deviné.** Un libellé à une seule valeur ne correspond jamais à une variante à deux valeurs. Deux variantes qui donnent la même clé sont ambiguës : elles ne peuvent être ni déclarées ni rapprochées.
- **Déclaration globale conservée** : elle s'applique aux variantes qui n'ont pas de déclaration propre.
- **Déclaration propre à une variante** : elle a ses propres lignes et ses propres événements de qualification. Une qualification du produit ne qualifie donc jamais le chiffre d'une variante, et inversement.
- **Le coût d'une variante n'est jamais réutilisé pour une autre.** Pour une commande, on prend la déclaration de sa variante en vigueur ; à défaut, la déclaration globale en vigueur, avec la mention « déclaration globale appliquée » ; sinon rien.
- **Date d'effet** : par défaut, la date de la déclaration. Elle peut être plus tardive (jusqu'à un an) mais jamais passée : les commandes déjà payées gardent le coût alors en vigueur.
- **Traçabilité** : chaque déclaration conserve son historique, son auteur, sa date de déclaration, sa date d'effet et son statut de vérification, attribué uniquement par une personne.
- **Comparaison** : une déclaration globale n'est jamais « comparable » à l'observation d'une variante précise, la raison est affichée.
- **Caractère facultatif** : rien ne conditionne la publication d'un produit.

## 6. Ce qui reste à décider (fondateur)

1. **Appliquer la migration**, d'abord sur la branche de préproduction puis en production, à la main et avant tout push qui l'utilise : `npm run schema:migrate -- --expect-endpoint <ep>`. D'ici là, le registre répond « indisponible » sans planter.
2. **Alimentation automatique depuis Stripe Issuing** : lire les captures et les remboursements de chaque carte à usage unique et les enregistrer en `stripe_issuing`. Ce n'est pas construit. Il faudra une clé restreinte en lecture et une décision sur le moment de la lecture, car c'est une lecture de la chaîne de paiement.
3. **Qui saisit les relevés**, et à quelle fréquence.

## Fichiers

- Migration : `prisma/migrations/20261119090000_procurement_debit_register`
- Règles (pures) : `lib/procurement-debits/register.ts`
- Écritures et lectures : `lib/procurement-debits/register.server.ts`
- API administrateur :
  - `GET|POST /api/admin/procurement-debits`
  - `POST …/<id>/allocations`
  - `POST …/<id>/void`
  - `POST …/allocations/<allocationId>/revoke`
  - `GET /api/admin/orders/<id>/procurement-cost`
- Page : `/admin/procurement-debits` (navigation : « Débits d'achat »)
- Variantes :
  - `lib/supplier-costs/variant-key.ts`
  - `declaration.ts` (`resolveDeclarationForLine`, `parseEffectiveFrom`)
  - `declaration.server.ts`
- Tests :
  - `procurement-debit-register`
  - `procurement-debit-register-db` (vraie base PostgreSQL en CI)
  - `supplier-cost-variants`
