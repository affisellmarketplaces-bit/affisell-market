# Sécurisation des versements — plan d'adoption (2026-11-25)

Rien de ce document n'a été exécuté sur une base réelle, sur Stripe ou sur Vercel. Chaque étape marquée **[décision]**
attend l'accord écrit du fondateur.

## 1. État réel

| Élément | État |
|---|---|
| Production (`main`) | `c593b698c`, 4 novembre. **313 commits de retard** sur `release/finalisation-2026-11-13` (PR #9, brouillon) |
| Déploiement | Compte Vercel bloqué (« Account is blocked ») : aucun déploiement possible actuellement |
| Risque A3 en production | Ouvert. `lightningEnabled = true` pour 1 fournisseur, 58 commandes payées exposées (mesure du 2026-11-25) |
| Second défaut de production | Lightning paie le fournisseur, échoue sur le revendeur, remet la commande en `PENDING` **sans enregistrer** le virement fournisseur → `process-transfers` le repaie |
| PR #11 | Base de #12 ; CI verte |
| PR #12 | Registre `PayoutLeg` ; CI verte (`d2f48bc88`) ; migration non appliquée |
| PR #13 (nouvelle) | Correctif minimal A3 sur `main`, sans migration |
| Cloudflare Workers Builds | Déconnecté ce jour (plus de builds parasites) |

## 2. Deux voies, complémentaires

**Voie A — immédiate, sans déploiement** : passer `lightningEnabled` à `false` pour l'unique fournisseur concerné
(requête gardée fournie le 2026-11-25). Neutralise A3 et le second défaut, Lightning ne payant plus rien.
**[décision]** : écriture d'une ligne en production, que le fondateur exécute lui-même ou autorise.

**Voie B — correctif de code, dès que Vercel est débloqué** : PR #13 vers `main`. Deux fichiers, aucune migration,
aucune nouvelle table, testé (preuve par mutation). Protège même si le drapeau est réactivé. **[décision]** : fusion
puis déploiement.

**Voie C — correctif structurel** : PR #9 → #11 → #12. Elle exige au préalable :

1. la fusion de la PR #9 (313 commits) ;
2. **8 migrations** en production, car `schema:migrate` applique toutes celles en attente et le build Vercel refuse un
   schéma incomplet :
   - `product_price_history`, `listing_price_history`, `reseller_profit_alerts`, `intelligence_decision_journal`,
     `intelligence_signal_log`, `procurement_debit_register`, `listing_presence_history`, `payout_leg_registry`.

   Toutes sont additives, mais `listing_presence_history` démarre une collecte (décision distincte,
   `docs/LAUNCH-GATE.md`).
3. la question de lignée des migrations (PR #10) : la chaîne ne reconstruit pas le schéma seule.

**Recommandation** : A maintenant, B au déblocage de Vercel, C dans le cycle normal de la finalisation. A et B sont
réversibles et indépendants de C.

## 3. Validation staging de la voie C

Prérequis : une autorisation écrite d'écriture sur staging (`ep-shy-wind-…`).

1. **Lire l'état des migrations de staging, en lecture seule** :
   `DATABASE_URL='<staging>' node scripts/prisma-explicit-db.mjs status`. Il dit exactement ce que `migrate deploy`
   appliquerait.
2. **[décision]** Appliquer : `DATABASE_URL='<staging>' npm run schema:migrate -- --expect-endpoint ep-shy-wind-…`,
   puis `npm run schema:verify`.
3. Vérifier le registre en lecture seule :
   - deux triggers présents (`PayoutLeg_guard`, `PayoutLeg_no_truncate`) ;
   - aucune ligne (`SELECT count(*) FROM "PayoutLeg"` = 0) ;
   - les contraintes `PayoutLeg_%_check` présentes.
4. `npm run report:payout-reconciliation` en mode **plan** sur staging : constats internes seulement, aucun appel
   Stripe.
5. Avec une clé Stripe **restreinte et de test** (« Transfers » en lecture) : `-- --execute` sur staging.
6. Parcours fonctionnel sur une Preview pointée sur staging, avec Stripe en mode test :
   - une commande payée ;
   - `process-transfers`, puis Lightning (fournisseur de test `lightningEnabled`) ;
   - attendu : 2 virements de test, 2 volets `PAID`, 2 lignes au registre comptable, aucun `IN_DOUBT`.

**Critères de réussite** : pas de `IN_DOUBT` inattendu, une seule `stripeTransferId` par volet, le rapport sans constat
« critical ».

## 4. Déploiement progressif en production (voie C)

1. Fenêtre calme ; `process-transfers` toujours actif. Le registre adopte au premier passage les volets déjà payés
   avant lui (tentative `SUCCESS`).
2. **[décision]** Migrations en production (`--confirm-production`), puis `schema:verify`, puis le push.
3. J+0 : lancer `report:payout-reconciliation` en plan ; lister les volets `IN_DOUBT` issus des traces historiques
   (attendus : au plus les 3 références inconnues et la trace Lightning, §5).
4. J+1 à J+7 : relancer le rapport chaque jour. Réactiver `lightningEnabled` seulement après 7 jours sans constat
   « critical » **[décision]**.
5. **Retour arrière** :
   - revenir au code précédent : la table reste et ne gêne rien ;
   - ne jamais exécuter le script destructif sans avoir soldé les volets `IN_DOUBT` / `PROCESSING` ;
   - une incertitude n'est jamais résolue en réinitialisant une tentative : on utilise
     `POST /api/admin/payout-legs` (`reconcile`, puis `confirm_not_paid` si la recherche est vide).

## 5. Cas historiques (aucun backfill automatique)

| Cas | Voie B (PR #13) | Voie C (PR #12) | Action humaine |
|---|---|---|---|
| 2 virements fournisseur de mai, `SUCCESS` sans ligne au registre comptable | Lightning refuse la commande (trace `transfer_attempt`) | Volet adopté `PAID`, sans écriture comptable | Vérifier chaque virement dans Stripe ; si conforme, écrire la ligne manquante par un script validé **[décision]** |
| 3 `Order.stripeTransferId` inconnus | Lightning refuse (trace `order_transfer_reference`) | Volet fournisseur `IN_DOUBT` | `report:payout-reconciliation --execute` **[décision]**, puis `reconcile` ou qualification |
| 1 commande avec identifiants Lightning sans ligne Lightning | Lightning refuse (`order_payout_transfer_ids`) | Adoption ou `IN_DOUBT` | Idem |

Dans les deux voies, aucun de ces cas ne peut être payé une seconde fois automatiquement.
