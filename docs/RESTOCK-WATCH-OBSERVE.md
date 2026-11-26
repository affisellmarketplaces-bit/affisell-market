# « Prévenez-moi au retour » — passer de `off` à `observe` (Preview), mesurer, décider

État au 2026-11-19 : développé et testé, **`RESTOCK_WATCH_MODE` non défini partout = `off`**. Rien n'est affiché, rien ne tourne. Aucune variable n'a été modifiée et aucun déploiement n'a été fait. Ce document prépare la décision ; il n'exécute rien.

## 1. Ce que change chaque mode

| | `off` (défaut) | `observe` | `enforce` |
|---|---|---|---|
| Bouton sur la fiche produit | caché | visible, texte « l'envoi des alertes n'est pas encore activé » | visible |
| Demande enregistrée | non (409 `mode_off`) | oui | oui |
| Cron `restock-watch-notify` (toutes les 30 min) | ne fait rien | mesure, ferme les demandes devenues inutiles | mesure, ferme, **envoie** |
| Web Push envoyé | jamais | **jamais** | une fois par demande, quand la déclinaison revient |
| Signal fournisseur (≥ 3 acheteurs) | vide (aucune demande) | alimenté | alimenté |

`observe` n'envoie donc rien à personne. En revanche, il montre le bouton aux acheteurs et le navigateur leur demande l'autorisation des notifications. Ce n'est pas neutre pour l'expérience : c'est pourquoi le premier passage se fait **sur la Preview seulement**.

## 2. Passage en `observe` sur la Preview — procédure (à exécuter seulement après autorisation)

1. Vercel → projet Affisell → Settings → Environment Variables → `RESTOCK_WATCH_MODE` = `observe`, **environnement Preview uniquement**.
2. Redéployer la Preview de la branche (la variable est lue à chaque requête, mais le cron et l'interface lisent la valeur du déploiement).
3. Vérifier `GET /api/restock-watch?listingId=<un produit en rupture>` → `"mode":"observe"`.
4. Le cron planifié GitHub Actions appelle **la production**, pas la Preview. Sur la Preview, on l'appelle à la main : `curl -H "Authorization: Bearer $CRON_SECRET" https://<preview>/api/cron/restock-watch-notify`.
5. Lire les mesures : `GET /api/admin/restock-watch-observations?days=30` (session ADMIN).

Retour arrière : supprimer la variable (ou `off`) et redéployer. Les demandes déjà enregistrées restent en base (journal d'audit), inactives, et expirent d'elles-mêmes au bout de 90 jours.

## 3. Ce qui est mesuré

Tout est stocké dans `AuditLog`, sans migration. Il n'y a que des compteurs : aucun identifiant d'acheteur, de produit ou de boutique n'est exposé par la lecture admin.

| Mesure | Origine | Nature |
|---|---|---|
| `active`, `activeBuyers`, `activeVariants` | instantané journalier `restock-watch-observation:<jour>` (1er passage du jour conservé) | **constaté** : demandes actives, acheteurs distincts, déclinaisons distinctes (fiche × déclinaison exacte) |
| `wouldNotifyNew` par jour | marqueurs `<demande>:observed:<épisode>`, créés la 1re fois qu'une demande serait envoyée | **théorique** : ce que `enforce` aurait envoyé ce jour-là. Un marqueur par demande et par épisode, jamais deux |
| `sent` par jour | réservations d'envoi `<demande>:sent:<épisode>` | **réel** : envois remis au Web Push. Toujours 0 en `observe` |
| `wouldNotify`, `noChannel`, `raced`, `closed`, `kept` | réponse du cron (journal `[restock-watch]`) | par passage : prêtes à partir, sans abonnement push, rupture revenue juste avant l'envoi, fermées (`variant_removed`, `listing_removed`, `expired`), en attente (`still_sold_out`, `not_sellable`, `not_listed`, `ambiguous_variant`) |

**Ne jamais confondre** `wouldNotifyNew` (possible) et `sent` (envoyé). La lecture admin les garde dans deux colonnes et ne les additionne jamais. `reading` vaut `no_data` sans aucun instantané, `too_few_days` sous 7 jours d'instantanés, `observed` au-delà.

## 4. Événements comptabilisés

- **Demande** : clic explicite d'un acheteur connecté, autorisation des notifications accordée, déclinaison exacte en rupture au moment du clic. Elle est refusée sinon (`variant_incomplete`, `variant_unknown`, `available_now`, `too_many` au-delà de 50 demandes actives par acheteur).
- **Redemande** : même acheteur, même fiche, même déclinaison. C'est la même demande. Après un envoi ou une annulation, une nouvelle demande ouvre un nouvel épisode.
- **Annulation** : uniquement par l'acheteur, et uniquement pour sa propre demande.
- **Fermeture automatique** : la déclinaison n'existe plus, la fiche est supprimée, ou la demande a plus de 90 jours.
- **« Revenue »** : la fiche est en ligne et visible des acheteurs, le produit est vendable pour toutes les autres raisons (`listingProblem` nul), et la déclinaison exacte a un stock > 0. Tout cas incertain laisse la demande en attente.

## 5. Volumes potentiels de notifications

- Au plus **1 notification par demande et par épisode**, donc au plus 1 par acheteur, par fiche et par déclinaison, tant qu'il ne redemande pas.
- Plafond par acheteur : 50 demandes actives, soit au plus 50 envois s'il en avait 50 et que tout revenait d'un coup.
- Le volume réel attendu en `enforce` est la somme journalière de `wouldNotifyNew` mesurée en `observe`. C'est cette série qu'on regarde. `wouldNotify`, qui recompte à chaque passage une demande déjà revenue, n'est pas un volume.

## 6. Conditions d'envoi (`enforce` seulement)

Toutes doivent être vraies, dans l'ordre :

1. la demande est active et a moins de 90 jours ;
2. la déclinaison est revenue (§4), et une **relecture de la fiche juste avant l'envoi** le confirme (sinon `raced`, rien ne part) ;
3. l'acheteur a encore au moins un abonnement push (sinon `noChannel`, la demande attend) ;
4. la réservation `<demande>:sent:<épisode>` est obtenue (une seule exécution concurrente gagne).

Ensuite, envoi par le canal Web Push existant, et la demande passe à « notifiée ». Le texte ne promet aucune date et précise que les quantités peuvent être limitées.

## 7. Limites des données

- En `CHECKOUT_STOCK_MODE=warn` (le défaut), le stock est **celui que le fournisseur déclare** : rien ne le décompte à la vente. Une déclinaison « revenue » peut en réalité ne plus avoir d'unités. D'où la mention « quantités limitées ».
- Il n'existe aucune date de réassort dans Affisell. La fonction ne prévoit donc rien : elle constate.
- L'instantané journalier garde le **premier** passage du jour. Les compteurs de flux (`wouldNotifyNew`, `sent`) sont, eux, exacts sur toute la journée.
- Les demandes sont dans le journal d'audit (lecture par chemin JSON). Ça convient jusqu'à quelques dizaines de milliers de demandes ; au-delà, une table dédiée sera nécessaire (migration = décision fondateur).
- Un acheteur qui retire l'autorisation des notifications dans son navigateur garde une demande active, sans canal (`noChannel`), jusqu'à expiration.
- Le signal fournisseur ne compte que des demandes explicites. Ce n'est pas une prévision de ventes.

## 8. Critères pour décider ensuite d'`enforce`

À réunir sur la Preview, puis sur une période d'`observe` en production si vous l'autorisez :

1. au moins 7 jours d'instantanés (`reading: observed`) ;
2. `wouldNotifyNew` journalier compris et acceptable, avec un plafond raisonnable par acheteur (aucun acheteur avec des dizaines de demandes revenues le même jour) ;
3. part de `noChannel` faible : si elle est forte, les abonnements push se perdent et l'envoi serait illusoire ;
4. `raced` rare : s'il est fréquent, le stock déclaré est trop instable pour annoncer un retour ;
5. protocole navigateur du §9 réussi sur Chrome, Firefox et Safari ;
6. décision explicite du fondateur sur `CHECKOUT_STOCK_MODE` (un retour annoncé sur un stock non décompté peut décevoir).

## 9. Protocole de test Web Push réel — sans aucun vrai utilisateur

Le but est de prouver l'envoi de bout en bout dans un vrai navigateur, sur la Preview, avec des comptes de test seulement.

1. **Prérequis** : Preview sur la base de staging (jamais la production). Clés VAPID présentes sur la Preview (`npm run verify:web-push`). `RESTOCK_WATCH_MODE=enforce` **sur la Preview uniquement, pendant le test**, puis retour à `observe`/`off`. Il n'y a pas d'autre utilisateur réel sur la base de staging.
2. **Données** : un compte fournisseur de test (Demo Lab `*@demo.affisell.com`) et un produit de test à deux déclinaisons, `Test / M` à 0 et `Test / L` à 3, listé par un revendeur de test. Un compte acheteur de test.
3. **Inscription** : avec le compte acheteur, dans Chrome, ouvrir la fiche, choisir `Test / M`, cliquer « Me prévenir », accepter la notification. Attendu : « Vous serez prévenu — annuler ».
4. **Pas de fausse alerte** : appeler le cron. Attendu : `wouldNotify: 0`, aucune notification reçue.
5. **Mauvaise déclinaison** : passer `Test / L` à 5, appeler le cron. Attendu : aucune notification.
6. **Retour réel** : passer `Test / M` à 2, appeler le cron. Attendu : **une** notification « De retour : … », un clic ouvre la fiche, puis `sent: 1` côté admin.
7. **Pas de répétition** : rappeler le cron deux fois. Attendu : aucune nouvelle notification.
8. **Course** : nouvelle demande sur un autre produit de test, stock remis à 1 puis à 0 avant l'appel du cron. Attendu : rien.
9. **Annulation** : nouvelle demande, annulation par le bouton, puis retour en stock et cron. Attendu : rien.
10. **Permission retirée** : nouvelle demande, retirer l'autorisation dans les réglages du navigateur, retour en stock. Attendu : `noChannel`, rien.
11. Répéter 3 à 7 dans Firefox et Safari (macOS ≥ 13 / iOS ≥ 16.4 en web app installée).
12. **Fin** : remettre `RESTOCK_WATCH_MODE` sur la Preview à sa valeur d'avant et redéployer.

Les tests automatisés (`restock-watch`, `restock-demand`, `variant-table-parity`) couvrent la logique, mais pas le navigateur ni le service de push. Ce protocole est la seule preuve d'un envoi réel ; il n'a pas encore été exécuté.

## 10. Après la demande : la chaîne mesurée (ajout 2026-11-20)

Chaque déclinaison qui atteint 3 acheteurs distincts ouvre un **épisode de demande**, suivi par le même cron. Chaque étape a sa nature :

| Étape | Nature | Champ |
|---|---|---|
| Demande | observé | `buyersAtOpen`, `peakBuyers`, `buyersAtBack` |
| Recommandation | recommandation : disponible dès l'ouverture, **servie** au fournisseur la première fois que sa carte l'affiche | `recommendationShownAt` |
| Action du fournisseur | action : fiche modifiée (une date de fiche, pas un réassort) ; quantité vue > 0 | `sheetModifiedAt`, `stockSeenAt` |
| Retour en disponibilité | observé : quantité > 0 **et** produit vendable **et** en ligne | `backAt`, `unitsAtBack` |
| Notification | réel et théorique, séparés | `notificationsSent`, `notificationsTheoretical` |
| Achats | résultat commercial, à la lecture : commandes distinctes de la déclinaison dans les 30 jours, remboursées/annulées à part | `ordersAfterReturn`, `refundedOrCancelled`, `byWaitingBuyers` |

**Lecture honnête** : une commande après un retour en stock est une *association*. Elle ne prouve pas que la demande ou la recommandation l'a provoquée (pas de groupe témoin). Les cas où la commande ne peut pas être rattachée à la déclinaison (déclinaisons à capacité) sont comptés à part comme « non évaluables ».

Indicateurs de décision : taux de retour, délai médian demande → retour, demandes closes sans retour, retours partiels, nouvelles ruptures, achats après retour. Le fournisseur les voit pour ses propres produits, le fondateur pour tous (lecture admin ci-dessus). Tout cela n'existe qu'une fois le mode passé à `observe` (§2).
