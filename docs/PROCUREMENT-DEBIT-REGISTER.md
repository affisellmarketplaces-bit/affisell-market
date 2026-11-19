# Registre des débits d'achat, import Stripe Issuing et coûts par variante

Rédigé le 19 novembre 2026, puis complété le même jour. Décisions validées par le fondateur le 19 novembre 2026 :

- enregistrer les montants réellement débités lors des achats ;
- déclarer des coûts par variante ;
- préparer l'import Stripe Issuing en lecture seule.

**État** : tout est développé et testé (tests unitaires et base PostgreSQL de test en CI). Rien n'a encore servi sur des données réelles.

- La migration n'est **appliquée nulle part** : ni en préproduction, ni en production.
- L'import Issuing n'est **branché nulle part** : aucune route, aucune tâche planifiée, aucun webhook. Aucune clé n'existe pour lui.
- Aucun flux financier n'a été modifié.

## 1. Trois montants à ne jamais confondre

| Montant | Ce que c'est | Où il vit | Peut-il valoir coût réel ? |
|---|---|---|---|
| Prix mémorisé | Prix de la source retenu par Affisell : `Order.aeWholesaleCents` = prix unitaire × quantité, livraison exclue, TVA inconnue | La commande | **Jamais.** C'est l'enregistrement d'Affisell ; aucun argent n'a bougé. |
| Montant débité | Ce qui a quitté le compte pour la marchandise, en euros réglés : débits − remboursements + annulations de remboursement | `ProcurementDebit` + `ProcurementDebitAllocation` | Oui, mais seulement pour une commande **entièrement rapprochée**. |
| Coût complet | Montant débité + frais rapprochés | Idem | Même condition. |

## 2. Ce qui est un mouvement, et ce qui n'en est pas

Le vocabulaire suit Stripe Issuing (docs.stripe.com/issuing/purchases/transactions, lu le 19 novembre 2026).

| Événement | Argent déplacé ? | Dans le registre |
|---|---|---|
| **Autorisation** : réservation de fonds au moment de l'achat | Non | **Jamais**. Une autorisation annulée ou expirée ne laisse aucune trace d'argent. |
| **Capture** : `issuing.transaction` de type `capture`, montant négatif | Oui, sortie | `debit`. Les captures partielles, multiples, supérieures à l'autorisation ou forcées donnent chacune un débit. |
| **Règlement** | C'est la capture elle-même : le solde Issuing est débité à la capture | Le montant réglé est le `amount` de la transaction, dans la devise du solde (EUR). La pièce justificative est l'identifiant `txn_` quand Stripe le fournit. |
| **Remboursement** : type `refund`, montant positif | Oui, entrée | `refund`, rattaché au débit qu'il rembourse. |
| **Annulation de remboursement** : type `refund`, montant négatif (rare) | Oui, sortie | `refund_reversal`, compté comme une nouvelle sortie d'argent. |
| **Annulation d'une commande chez la source** | Avant capture : non. Après capture : oui, sous forme de remboursement | Avant capture : rien. Après capture : un `refund`. |
| **Frais** (carte, change, douane) | Oui | `fee`, saisi d'après facture. Issuing ne facture pas ces frais transaction par transaction. |

**Origine des montants** (`amountOrigin`) : soit `read_from_source` (lu chez Stripe par l'import), soit `typed_from_document` (saisi d'après un relevé ou une facture, justificatif obligatoire). Un mouvement Issuing est **toujours** lu à la source : la saisie manuelle « Issuing » est refusée, par le code comme par la base. Les identifiants Stripe conservés (`ipi_`, `ic_`, `iauth_`, `txn_`) désignent des objets ; aucun ne contient de donnée de carte. Un numéro de carte est refusé partout : la base n'accepte que des identifiants de forme Stripe, et le code bloque toute suite de 13 à 19 chiffres qui passe l'algorithme de Luhn.

## 3. États d'un mouvement

| État | Rapprochable ? | Effet sur le coût d'une commande |
|---|---|---|
| `voided` (annulé) | Non | Ne compte plus. |
| `needs_review` (à examiner) | **Non** : refusé par le code et par la base | Le coût de toute commande dont un achat est concerné (même débit ou même carte) reste provisoire. |
| `not_allocatable` | Non | Le montant réglé en euros est inconnu. |
| `unallocated` (non rapproché) | Oui | Ne compte pour aucune commande. |
| `partially_allocated` (partiellement rapproché) | Oui, pour le reste | Les commandes concernées restent provisoires. |
| `fully_allocated` (entièrement rapproché) | Non (plus rien à attribuer) | Compte pour la part attribuée à chaque commande. |

Un mouvement à examiner se résout par une personne, avec un motif (`POST /api/admin/procurement-debits/<id>/review`). Pour un remboursement, elle désigne son débit d'origine : un débit enregistré, de la même source et, pour Issuing, **de la même carte**. La résolution ne rapproche rien automatiquement.

## 4. Pas d'attribution arbitraire, pas de double comptage

Le code applique chaque règle et la base la vérifie de nouveau :

- **Unicité de la transaction** : une référence de transaction n'existe qu'une fois par source.
- **Un rapprochement par commande** : un mouvement n'a qu'un seul rapprochement actif par commande.
- **Plafond** : le total des rapprochements actifs d'un mouvement ne dépasse jamais son montant réglé. Un déclencheur verrouille la ligne, ce qui couvre aussi les écritures concurrentes et l'insertion SQL directe.
- **Mouvements bloqués** : un mouvement annulé, à examiner, sans euros réglés ou remboursement sans débit n'est pas rapprochable.
- **Carte Issuing** : un mouvement Issuing ne peut être attribué **qu'à la commande que la carte désigne**, d'après l'enregistrement d'Affisell (`FulfillmentLog.virtualCardId`, une carte à usage unique par commande). Jamais à une commande choisie à la main.
- **Remboursement plafonné** : un remboursement ne dépasse jamais la part de la commande dans son débit, tous remboursements et annulations confondus. Une annulation de remboursement ne reprend que ce que la commande a reçu.
- **Saisie manuelle** : une attribution manuelle (`manual`) exige un motif. Tout est tracé dans le registre et dans `AuditLog`, et rien n'est jamais supprimé.

## 5. Coût réel d'une commande

Une commande est **rapprochée** quand toutes ces conditions sont réunies :

- au moins un débit lui est attribué ;
- chaque mouvement qui la concerne est entièrement réparti ;
- aucun remboursement ni frais de ses débits ne reste à répartir ;
- aucun mouvement de la même carte ou du même débit n'attend d'examen ;
- le net n'est pas négatif.

Seule une commande rapprochée a un « coût réel » (`realFullCostCents`). Sinon, les chiffres restent marqués provisoires, avec la raison. Seules les commandes rapprochées alimentent le registre des coûts constatés et la comparaison avec les coûts déclarés.

## 6. Import Stripe Issuing — préparé, en lecture seule, non branché

**Ce qui est lu.**

- `GET /v1/issuing/transactions` : liste filtrée par `created[gte]` et paginée par `starting_after`. C'est le seul appel.
- Rien d'autre n'est nécessaire pour savoir ce qui a été payé. Les autorisations (`issuing.authorization`) ne sont pas lues.

**Permission minimale.**

- Une clé **restreinte** (`rk_test_` ou `rk_live_`) avec uniquement la permission « Issuing → Transactions : lecture ».
- Une clé complète (`sk_…`) est refusée, car elle peut écrire. Une clé live est refusée hors production.
- Le lecteur est un objet figé qui n'expose qu'une seule méthode GET. Il n'utilise pas le client Stripe de l'application.
- Variable à créer : `STRIPE_ISSUING_READ_KEY`. Elle n'existe pas aujourd'hui ; je ne l'ai ni demandée ni utilisée.

**Événements**, si un webhook est préféré plus tard :

- `issuing_transaction.created` (`.updated` pour signaler un changement) suffisent ;
- `issuing_authorization.*` est inutile pour le coût.

Recommandation : une tâche planifiée qui relit les transactions, plutôt qu'un webhook. Elle est idempotente, rattrape les manques et ne demande aucun secret de signature supplémentaire.

**Règles de l'import** (`lib/procurement-debits/issuing-import.ts`).

- **Lecture stricte** : tout objet inattendu (type, montant, devise, identifiant illisible) n'est pas importé, et la raison est donnée.
- **Mode test ou live** : une transaction de l'autre mode n'est jamais importée.
- **Rattachement d'un remboursement** : Stripe prévient que ce lien est imprécis. Un remboursement n'est rattaché que s'il est certain :
  - même carte et même autorisation qu'une capture unique ;
  - ou même carte, si celle-ci n'a qu'une seule capture.
  - Sinon il est enregistré **à part** (`needs_review`).
- **Solde dans une autre devise que l'euro** : le montant réglé reste inconnu et le mouvement est mis à part.
- **Montants contradictoires** : un montant marchand en euros différent du montant débité est mis à part.
- **Rapprochement automatique** : seulement si la carte correspond à **une seule** commande d'après l'enregistrement d'Affisell. Sinon le mouvement est enregistré sans rapprochement, avec la raison (carte sans commande, ou carte liée à plusieurs commandes).
- **Idempotence** :
  - l'identifiant de transaction est la référence unique ;
  - une deuxième exécution n'enregistre rien ;
  - une transaction dont Stripe donne désormais d'autres montants est signalée, jamais réécrite.
- **Reprise** : le point de reprise n'avance qu'une fois la fenêtre entièrement lue. La fenêtre suivante recommence deux jours avant ce point. Le traitement s'arrête à 50 pages par exécution.
- **Mode à blanc** (`apply: false`, par défaut) : l'import lit et planifie sans rien écrire.
- **Aucune action financière** : jamais de paiement, de remboursement ou de virement. Les tests le vérifient.

**Pour l'activer** (décisions du fondateur, rien n'est fait) :

1. Créer la clé restreinte, d'abord en **mode test**.
2. Appliquer la migration en préproduction.
3. Lancer l'import à blanc, puis réel, sur la préproduction en mode test.
4. Décider de la fréquence.
5. Seulement ensuite : la clé live et la production.

## 7. Coûts déclarés par variante

- **Identité d'une variante** : une seule clé canonique (`lib/supplier-costs/variant-key.ts`). Elle fait correspondre trois écritures : « Noir · M » sur la commande, « Noir / M » sur la ligne SKU, et la table des variantes. Rien n'est deviné : deux variantes qui portent le même nom sont ambiguës, et ne peuvent être ni déclarées ni rapprochées.
- **Déclaration globale** : conservée, elle s'applique aux variantes sans déclaration propre. Une déclaration propre à une variante a ses lignes et ses qualifications à elle. **Le coût d'une variante n'est jamais réutilisé pour une autre.**
- **Traçabilité** : chaque déclaration garde son historique, son auteur, sa date de déclaration, sa date d'effet (future possible, jamais passée) et son statut de vérification. Ce statut n'est attribué que par une personne, et une nouvelle déclaration repart à « non vérifiée ».
- **Non-rétroactivité, testée sur une grille exhaustive** (jours de déclaration × délais d'effet × jours de paiement × variantes) : une commande ne reçoit jamais une déclaration faite ou entrée en vigueur après son paiement. Elle reçoit toujours la plus récente déjà en vigueur pour sa variante, sinon la globale.
- **Confidentialité et caractère facultatif** : inchangés. Rien ne conditionne la publication d'un produit.

## 8. Migration : procédure de préproduction et critères de validation

**Déjà testé** (base PostgreSQL jetable, en local et en CI) :

- application deux fois de suite ;
- chaque contrainte, déclencheur compris, y compris avec des écritures concurrentes ;
- script de retour arrière appliqué deux fois, puis réapplication de la migration ;
- import Issuing de bout en bout avec un faux lecteur ;
- déclarations par variante.

**Procédure de préproduction** (à lancer seulement sur votre accord) :

1. **Cible** : la branche Neon de préproduction (`ep-shy-wind-…`), jamais la production.
2. **Migration** : `DATABASE_URL='<url préprod>' npm run schema:migrate -- --expect-endpoint <ep préprod>`, puis `npm run schema:verify`.
3. **Contrôles du catalogue de la base** :
   - les deux tables existent ;
   - le déclencheur `ProcurementDebitAllocation_within_debit` est actif ;
   - les contraintes `ProcurementDebit_*_check` sont présentes ;
   - l'index unique partiel existe.
4. **Recette fonctionnelle sur la préproduction**, depuis `/admin/procurement-debits` :
   - saisir un débit d'après relevé, le rapprocher, constater le refus d'une surallocation ;
   - révoquer le rapprochement, annuler le mouvement ;
   - saisir un débit en dollars sans euros réglés et constater qu'il n'est pas rapprochable ;
   - consulter le coût d'une commande et vérifier que le statut « provisoire » s'affiche.
5. **Import Issuing en mode test** (clé `rk_test_`) : passage à blanc, puis réel. Vérifier les rapprochements automatiques, les mouvements « à examiner » et qu'une deuxième exécution n'ajoute rien.
6. **Critères de validation** :
   - aucune erreur de migration, `schema:verify` vert ;
   - toutes les étapes 3 à 5 conformes ;
   - les journaux ne contiennent aucune donnée de carte ;
   - aucune table existante modifiée ;
   - la CI est verte sur le même commit.
7. **Retour arrière** :
   - **Préféré** : revenir au code précédent. Les tables sont isolées, sans clé étrangère vers le reste du schéma ; inutilisées, elles ne gênent rien.
   - **Destructif**, sur décision seulement : `scripts/migration-rollbacks/20261119090000_procurement_debit_register.down.sql`. Il efface tous les mouvements. L'historique de migration de Prisma n'est pas modifié : pour recréer les tables, rejouer le SQL de la migration à la main (il est idempotent).

## 9. Proposition : qui saisit et rapproche, et à quelle fréquence

Je n'ai pas lu le volume réel (aucun accès à la production). La proposition dépend donc du nombre d'achats par mois, à vérifier avec `report:fee-reconciliation` en mode plan, une fois autorisé.

- **Achats Issuing.** Rien à saisir : l'import les enregistre et les rapproche lui-même quand la carte désigne une seule commande. Le travail humain se limite à la **file « à examiner »**.
- **Relevés et factures** (hors Issuing). Une seule personne responsable : le fondateur au départ, puis l'assistant comptable ou administratif. Une seconde personne relit les rapprochements manuels (`manual`) et toute annulation.

| Volume d'achats source | Saisie des relevés | File « à examiner » | Contrôle croisé |
|---|---|---|---|
| Moins de 50 par mois | Mensuelle, à la clôture du relevé | Hebdomadaire | Mensuel, par le fondateur |
| 50 à 500 par mois | Hebdomadaire | Deux fois par semaine | Mensuel, par l'expert-comptable sur échantillon |
| Plus de 500 par mois | Import automatique du relevé bancaire (à construire), saisie manuelle en exception | Quotidienne | Mensuel, avec un indicateur « mouvements non rapprochés depuis plus de 15 jours » |

**Indicateur à suivre dans tous les cas** : le nombre et le montant des mouvements non rapprochés ou à examiner depuis plus de 15 jours. Il devrait être proche de zéro avant toute décision commerciale fondée sur les coûts réels.

## 10. Décisions qui restent au fondateur

1. Appliquer la migration, d'abord en préproduction (§ 8).
2. Créer la clé restreinte de lecture Issuing, d'abord en mode test, et choisir la fréquence de l'import (§ 6).
3. Désigner la personne responsable des relevés et la fréquence de saisie (§ 9).

## Fichiers

- **Migration** : `prisma/migrations/20261119090000_procurement_debit_register`
- **Retour arrière** : `scripts/migration-rollbacks/20261119090000_procurement_debit_register.down.sql`
- **Règles** : `lib/procurement-debits/register.ts`
- **Écritures et lectures** : `lib/procurement-debits/register.server.ts`
- **Import Issuing** : `lib/procurement-debits/issuing-import.ts` (règles), `.server.ts` (application), `issuing-reader.ts` (le seul accès à Stripe)
- **API administrateur** :
  - `GET|POST /api/admin/procurement-debits`
  - `POST …/<id>/allocations`
  - `POST …/<id>/void`
  - `POST …/<id>/review`
  - `POST …/allocations/<allocationId>/revoke`
  - `GET /api/admin/orders/<id>/procurement-cost`
- **Page** : `/admin/procurement-debits`
- **Variantes** : `lib/supplier-costs/variant-key.ts`, `declaration.ts`, `declaration.server.ts`
- **Tests** :
  - `procurement-debit-register`
  - `procurement-issuing-import`
  - `procurement-debit-register-db` (import, retour arrière)
  - `supplier-cost-variants`
  - `supplier-cost-variants-db`
