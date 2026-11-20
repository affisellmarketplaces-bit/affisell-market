# Passage en mode bloquant — critères (préparé le 18 novembre 2026)

Quatre interrupteurs sont en mode observation. Aucun n'est activé en production : chaque passage est une décision
du fondateur. Ce document dit, pour chacun, ce qu'il faut mesurer, à partir de quels journaux, et à quelles
conditions le passage est techniquement sûr. Les seuils sont des propositions techniques, à confirmer.

Je n'ai pas accès aux journaux de production. Les chiffres réels sont donc à relever (Vercel → Logs, filtre sur le
préfixe indiqué) ou avec les rapports en lecture seule cités.

## 1. `CHECKOUT_STOCK_MODE` — stock avant et pendant le paiement

- **Journaux** : `[checkout] would_refuse_insufficient_stock`, `[stock] would_decrement`, `[stock] would_drop`.
- **Rapport** : `npm run report:checkout-stock` (lecture seule).
- **Préalables techniques (faits le 18/11)** : le formulaire ne ressuscite plus les unités vendues (produit et
  lignes de variantes), la synchro n'écrit plus le statut commercial, Ghost ne dépublie plus.
- **Critères proposés** :
  1. sur 14 jours, `would_drop` = 0 pour les produits dont le stock est réellement tenu par le fournisseur ;
  2. les produits à stock nominal (99 / 999 / 1 posés par les importeurs) sont listés et leur stock corrigé ou
     marqué « non suivi » avant le passage, sinon ils seront épuisés après N ventes ;
  3. `would_refuse` correspond à des ruptures réelles (vérification sur un échantillon de 20 refus).
- **Décision liée** : remise en stock des retours (voir 4).

## 2. `LISTING_READINESS_MODE` — publication

- **Journaux** : `[listing-readiness] would_refuse_if_enforced` (créations, publications, imports).
- **Rapport** : `npm run report:listing-readiness` (lecture seule).
- **Préalables techniques (faits)** : les quatre imports automatiques et la validation des imports revendeurs
  passent par le même contrôle ; en `enforce`, un import incomplet devient un brouillon au lieu d'échouer.
- **Critères proposés** :
  1. chaque interface de publication permet de compléter les champs exigés (fait : formulaire, assistant guidé,
     Express, modèle CSV) ;
  2. part des publications de la semaine qui seraient refusées < 10 %, ou fournisseurs concernés prévenus ;
  3. aucun refus dû à un faux positif (échantillon de 20 refus lus à la main).

## 3. `PROCUREMENT_CHECKOUT_GATE` — produits que seul un achat externe peut livrer

- **Journaux** : `[procurement-checkout] would_refuse_external_purchase_disabled`.
- **Critères proposés** : tant que l'achat automatique est coupé (`AUTO_BUY_ENABLED` absent), chaque ligne relevée
  ici est une vente que personne ne livrera sans achat manuel. Passer en `enforce` dès que ce nombre n'est pas nul
  et qu'aucun achat manuel n'est organisé pour ces produits — ou retirer ces produits du catalogue.

## 4. `RETURN_RESTOCK_MODE` — remise en stock des retours

- **Étapes** : `observe` d'abord (journal `[return-restock] would_restock`), puis `enforce`.
- **Préalable** : `CHECKOUT_STOCK_MODE=enforce` (sans décrément à la vente, il n'y a rien à rendre — le code le
  refuse de lui-même, raison `never_decremented`).
- **Critères proposés** : 20 inspections enregistrées, résultats « revendable » vérifiés sur un échantillon.
- **Décision** : un article retourné en bon état est-il remis en vente ? (règle commerciale).

## Ordre conseillé

1. `PROCUREMENT_CHECKOUT_GATE` (le plus petit périmètre, protège l'acheteur).
2. `LISTING_READINESS_MODE` (n'affecte que les nouvelles publications).
3. `CHECKOUT_STOCK_MODE` (touche toutes les ventes de produits physiques).
4. `RETURN_RESTOCK_MODE` en `observe`, puis `enforce`.

Chaque passage se fait sur une Preview d'abord, puis en production sur ta décision, et se réverse en remettant la
variable à `warn` / `off` sans déploiement de code.

## 5. `PARTNER_STOCK_SYNC_MODE` et planification de `sync-stock` (ajouté le 18 novembre, soir)

- **État** : la tâche n'est pas planifiée. Son mode par défaut est désormais `observe` : elle calcule et journalise
  (`[sync-stock] would_write`, `skipped`) sans rien écrire, pas même l'état de synchronisation du partenaire.
- **Ce qu'elle refuse déjà d'écrire** : une valeur illisible du partenaire (une panne d'API ne met plus un produit en
  rupture), un produit dont le stock est tenu par ligne de variante, une valeur inchangée. Elle n'écrit jamais
  `active` ni la publication.
- **Critères proposés pour la planifier** : 1) décision sur le sens de `active` (déjà prise de fait : la tâche ne
  l'écrit plus) ; 2) une semaine en `observe` planifiée, lecture des `would_write` — écarts plausibles, aucune rafale
  de mises à 0 ; 3) puis `enforce`.

### Protocole d'observation d'une semaine (préparé le 19 novembre — non planifié)

1. **Préalable** : `PARTNER_STOCK_SYNC_MODE` absent ou `observe` sur l'environnement visé (vérifier la variable
   avant tout), et au moins un fournisseur partenaire configuré (`BlindDropshipSupplier`, API REST).
2. **Planification, sur ta décision** : ajouter la route à `scheduled-crons.yml` en mode `lenient`, une fois par
   jour, pendant 7 jours. En `observe`, la tâche lit le stock du partenaire et la base, et n'écrit rien.
3. **Ce que chaque exécution produit** : une ligne `[sync-stock] run_observation` et le champ `observation` de la
   réponse : écritures qui auraient eu lieu (`wouldWrite`), dont mises à 0 (`toZero`), retours de 0 (`fromZero`),
   grands écarts (`largeChange` : plus de la moitié et au moins 10 unités), et produits écartés (valeur illisible,
   stock par variante, inchangé).
4. **Critères de réussite au bout de 7 jours** :
   - aucune exécution en erreur, ou des erreurs expliquées (partenaire indisponible) ;
   - `toZero` cohérent avec de vraies ruptures (vérification par échantillon sur la fiche du partenaire) ;
   - `largeChange` rare et expliqué ; aucune rafale (par exemple tous les produits d'un fournisseur à 0 le même jour) ;
   - `unreadable` proche de 0 (sinon, corriger d'abord le connecteur du fournisseur concerné).
**Ce qui est prouvé par les tests, sur la vraie route** (`sync-stock-observation-route.test.ts`) : en `observe`,
aucune écriture, ni sur les produits ni sur l'état de synchronisation du partenaire, même quand le partenaire est en
panne ; une valeur illisible n'est jamais écrite ; les grands écarts, mises à 0 et retours de 0 sont comptés, au total
et par fournisseur ; chaque ligne de journal d'une exécution porte le même identifiant d'exécution (`runId`) ; `off`
arrête tout avant la moindre lecture ; en `enforce`, seul le stock est écrit, jamais la publication.

**Interrompre** : mettre `PARTNER_STOCK_SYNC_MODE=off` (effet à l'exécution suivante, sans déploiement de code), ou
retirer la ligne de `scheduled-crons.yml`.

5. **Ensuite seulement**, sur ta décision : `enforce`. Retour arrière immédiat : remettre `observe`. Les stocks
   déjà écrits restent tels quels (aucun statut de publication n'est jamais modifié par cette tâche).

## 6. Imports revendeurs — ce qui ne dépend plus d'un interrupteur

Depuis le 18 novembre au soir, une approbation administrative ne publie jamais un produit dont les données de
sécurité obligatoires manquent, **quel que soit** `LISTING_READINESS_MODE`. Ce n'est pas un mode à basculer : c'est la
règle de cette voie.

## 7. `OWED_TRANSFER_RESUME_MODE` — reprise des sommes dues

- `GET /api/admin/payouts/owed-without-connect/resume` donne, sans rien écrire, les virements qui seraient créés et
  pourquoi les autres ne le sont pas (déjà payé ailleurs, compte non prêt, remboursement partiel, litige…).
- **Critères proposés** : simulation relue ; vérification sur Stripe que chaque compte « à créer » est bien celui
  du partenaire ; premier passage sur une seule commande, puis contrôle du virement.
- Passer en `enforce` déclenche de vrais virements (par le cron existant) : **décision du fondateur**.

## 8. Tableau de bord des contrôles (mis à jour le 19 novembre)

| Contrôle | Développé | Testé (CI) | Prêt à activer | Réellement actif en production |
|---|---|---|---|---|
| Stock au paiement (`CHECKOUT_STOCK_MODE`) | oui | oui | après `report:checkout-stock` et décisions §1 | non (`warn`, aucune écriture) |
| Conformité des publications (`LISTING_READINESS_MODE`) | oui | oui | après `report:listing-readiness` | non (`warn`) |
| Achats externes au paiement (`PROCUREMENT_CHECKOUT_GATE`) | oui | oui | après lecture des journaux `would_refuse` | non (`warn`) |
| Remise en stock des retours (`RETURN_RESTOCK_MODE`) | oui | oui | oui techniquement ; décision commerciale | non (`off`) |
| Synchronisation partenaire (`PARTNER_STOCK_SYNC_MODE`) | oui | oui | après le protocole d'une semaine | non (tâche non planifiée) |
| Reprise des sommes dues (`OWED_TRANSFER_RESUME_MODE`) | oui | oui | après relecture de la simulation | non (`off`, aucun virement) |
| Validation des imports revendeurs | oui | oui | — (règle sans interrupteur) | actif dès le déploiement de la branche |
| Suspension Affisell distincte de la pause | oui | oui | — (outil d'administration) | actif dès le déploiement de la branche |

« Actif dès le déploiement » : la branche n'est pas déployée ; rien de ce tableau n'est actif aujourd'hui.
