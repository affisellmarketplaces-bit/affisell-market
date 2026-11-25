# Registre des volets de versement (`PayoutLeg`) — garantie « un volet, un virement »

Statut : **implémenté sur la branche `local/payout-unified-ledger`, non fusionné, non déployé, migration non appliquée**
(2026-11-25). Base : PR #11 (`8b36f6a5f`, insertion du registre comptable sans erreur d'unicité interceptée).

## 1. Le problème résolu

Avant ce chantier, trois rails actifs créaient des virements Stripe, chacun avec sa propre clé d'idempotence et sa propre
notion de « déjà payé » :

| Rail | Clé Stripe | Contrôle avant paiement |
|---|---|---|
| `process-transfers` | `transfer_<commande>_<RÔLE>` | tentative `PENDING`, commande pas `PAID` |
| Lightning | `lightning_<commande>_<rôle>` | `payoutStatus = PENDING` uniquement, réservation **après** les deux virements |
| Légion | `legion_sponsor_phase1_<commande>` | `legionPayoutStatus = reserved` |

Risques établis par l'audit du 2026-11-25 :

- **A1** — un virement créé dont la réponse est perdue n'est jamais enregistré ; après ~24 h, Stripe oublie la clé et une
  relance crée un second virement.
- **A2** — les paramètres (source, montant, destination) pouvaient différer entre deux tentatives ou deux rails.
- **A3** — Lightning et `process-transfers` pouvaient payer le même volet. En production, 58 commandes étaient exposées
  (un fournisseur `lightningEnabled`). Aucun doublon constaté à la date de l'audit.
- **A4** — des chemins créaient des virements sans clé (dropship aveugle, auto-order) ou étaient dormants.
- **Légion** — l'état `failed` mélangeait « Stripe a refusé » et « on ne sait pas ».

## 2. L'architecture

**Un volet** = un versement qui ne peut être payé qu'une fois. Sa clé (`legKey`) identifie le volet :

| Volet | `legKey` | `transfer_group` |
|---|---|---|
| Fournisseur, revendeur, parrain Légion d'une commande | `order:<commande>:SUPPLIER\|AFFILIATE\|LEGION_SPONSOR` | id de la commande |
| Groupe fournisseur d'une commande dropship aveugle | `blind_dropship:<commande>:<fournisseur>` | `blind_dropship_<commande>` |
| Fournisseur d'un lot auto-order | `auto_order:<lot>:<fournisseur>` | `auto_order_<lot>` |
| Retrait d'un agent | `agent_withdrawal:<écriture>` | `agent_withdrawal_<écriture>` |

**Un seul service** crée des virements : `executeLegTransfer` (`lib/payouts/leg-transfer.server.ts`). Le test
`payout-leg-single-entry.test.ts` analyse tout le dépôt et échoue si un autre fichier appelle `transfers.create` ou poste
sur `/v1/transfers` (vérifié en plantant un appel : le test échoue).

Déroulement, pour un volet :

1. **Réservation** dans une transaction PostgreSQL. La ligne est créée si besoin (`INSERT … ON CONFLICT DO NOTHING`) puis
   **verrouillée** (`SELECT … FOR UPDATE`). Les traces antérieures au registre sont lues :
   - tentative `SUCCESS` ou ligne du registre comptable avec un identifiant de virement → le volet est adopté comme payé ;
   - trace de paiement sans identifiant exploitable → `IN_DOUBT`.

   La décision (`decideClaim`, pure) est prise sous le verrou. Seul un volet `PENDING`, ou `FAILED_CONFIRMED` sous une
   nouvelle génération, passe `PROCESSING`. La requête Stripe exacte est alors **figée** dans la ligne. Deux workers,
   d'un même rail ou de deux rails, se sérialisent sur le verrou : le second reçoit `busy`.
2. **Recherche Stripe** avant toute création (`GET /v1/transfers?transfer_group=`) :
   - un virement de ce volet trouvé → il est **adopté**, rien n'est créé ;
   - un doublon, une incohérence de montant ou de destination, ou un virement non identifié dans le groupe → `IN_DOUBT` ;
   - une lecture incomplète ou en échec → la réservation est libérée (`PENDING`) et rien n'est créé.
3. **Création** avec la clé `affisell_leg:<legKey>:g<génération>`, **commune à tous les rails**. La requête figée est
   rejouée à l'identique, quel que soit le rail.
4. **Enregistrement** dans une seule transaction, gardée par le jeton de réservation : passage `PAID` et écritures du rail
   (tentative, registre comptable, statut Légion…) via `onPaid`. Si l'enregistrement échoue alors que le virement existe,
   le volet passe `IN_DOUBT` (`record_failed_after_transfer`) et ne sera jamais recréé.

**Pourquoi la recherche Stripe en plus de la clé** : dans les 24 h, la clé protège une relance ; au-delà, Stripe l'a
oubliée, mais le virement est depuis longtemps visible dans la liste. Aucun des deux mécanismes ne couvre seul les deux
fenêtres. Une recherche incomplète ne vaut jamais preuve d'absence.

**Métadonnées normalisées** posées sur chaque virement : `affisell_leg_key`, `affisell_order_id`, `affisell_role`,
`affisell_rail`, `affisell_kind`, `affisell_generation`. Les clés `orderId` et `role` sont conservées pour les anciens
lecteurs. La recherche reconnaît aussi les formes historiques (`process-transfers` `{orderId, role: SUPPLIER}`, Lightning
`{orderId, role: supplier, lightning}`, Légion `{order_id, role: sponsor}`). Un virement d'un groupe de commande qui n'en
porte aucune est « non identifié » et rend le volet douteux.

## 3. Machine à états

| État | Sens |
|---|---|
| `PENDING` | connu, non envoyé : jamais envoyé, ou libéré après un appel qui n'a **prouvablement** rien créé |
| `PROCESSING` | réservé par un worker (bail de 15 min) ; l'appel Stripe n'a lieu que dans cet état |
| `PAID` | un virement existe et est enregistré (terminal) |
| `IN_DOUBT` | un virement **peut** exister. Aucune création automatique : seule une adoption (→ `PAID`) ou une décision humaine (→ `FAILED_CONFIRMED`) en sort |
| `FAILED_CONFIRMED` | Stripe a refusé (erreur 4xx métier ou de validation), ou une personne a confirmé, après recherche complète, que rien n'a été payé. Nouvelle tentative possible sous une **nouvelle génération** (nouvelle clé) |

Transitions permises (imposées par le trigger `PayoutLeg_guard`, pas seulement par le code) :

| De → vers | Cause |
|---|---|
| (création) → `PENDING` / `PROCESSING` / `PAID` / `IN_DOUBT` | réservation, adoption, trace douteuse |
| `PENDING` → `PROCESSING` | réservation dans la **même** génération, paramètres identiques |
| `PENDING` → `PAID` | adoption (trace antérieure, virement trouvé) |
| `PENDING` → `IN_DOUBT` | trace antérieure sans identifiant |
| `PROCESSING` → `PAID` | virement créé et enregistré, ou trouvé dans Stripe |
| `PROCESSING` → `IN_DOUBT` | issue inconnue, bail expiré, recherche ambiguë, enregistrement échoué |
| `PROCESSING` → `FAILED_CONFIRMED` | refus Stripe prouvé |
| `PROCESSING` → `PENDING` | rien créé de façon prouvée (429, recherche incomplète) |
| `FAILED_CONFIRMED` → `PROCESSING` | **génération + 1** obligatoire |
| `FAILED_CONFIRMED` → `PAID` / `IN_DOUBT` | adoption / trace |
| `IN_DOUBT` → `PAID` | réconciliation qui adopte le virement |
| `IN_DOUBT` → `FAILED_CONFIRMED` | décision humaine, `resolvedBy` obligatoire |

**Interdits par la base** :
- toute sortie de `PAID` et tout changement de l'identifiant de virement d'un volet `PAID` ;
- `IN_DOUBT` → `PENDING` ou `PROCESSING` ;
- dans une même génération : modifier les paramètres économiques figés, la requête figée ou la clé d'idempotence ;
- `PROCESSING` sans jeton, sans paramètres figés ou sans clé ;
- un identifiant de virement porté par deux volets (`UNIQUE`) ;
- supprimer une ligne ou vider la table (`DELETE` / `TRUNCATE` refusés, sauf maintenance volontaire avec
  `set_config('affisell.payout_leg_purge','on',true)` dans la transaction).

**Classement des erreurs Stripe** (`classifyCreateError`) : c'est une **liste blanche** des preuves de non-création.
- `StripeInvalidRequestError` / `CardError` / `PermissionError` / `AuthenticationError` avec un statut 4xx (hors 409 et
  429) → `FAILED_CONFIRMED`.
- 429 → `PENDING` (non traité par Stripe).
- **Tout le reste est `IN_DOUBT`** : délai dépassé, erreur réseau, 5xx, 409, `idempotency_error`, erreur inconnue, erreur
  sans statut.

**Délais** :
- bail de réservation : 15 min (le client Stripe abandonne bien avant) ; au-delà, `IN_DOUBT` (`claim_lease_expired`),
  jamais `PENDING` ;
- délai de sécurité avant une confirmation humaine : 1 h après la dernière réservation.

## 4. Comportement par rail

| Rail | payé / déjà payé | `IN_DOUBT` | refus prouvé / non traité | autres |
|---|---|---|---|---|
| `process-transfers` | tentative `SUCCESS` + registre comptable (même transaction) | tentative reste `PENDING`, `errorCode = TRANSFER_IN_DOUBT`, **aucune tentative consommée**, une alerte | logique `MAX_ATTEMPTS` existante | `busy` : ignoré ; registre indisponible : aucune tentative consommée ; paramètres changés : `FAILED` + alerte |
| Lightning | même enregistreur que le rail standard ; un volet déjà payé par `process-transfers` revient `already_paid` | s'arrête ; le rail standard reprend la commande plus tard | s'arrête | — |
| Légion | `paid_24h` + total parrain (une fois) + registre comptable | `legionPayoutStatus = in_doubt` (redemandé toutes les 15 min **sans appel Stripe** jusqu'à adoption) | `failed` (pas de relance automatique) | reste `reserved` |
| Dropship aveugle | continue | `awaiting_manual_payment` + alerte ; une relance Inngest ne repaie jamais un groupe déjà payé | idem | — |
| Auto-order | `ok` | `ok: false` | `ok: false` | — |
| Retrait agent | identifiant de virement enregistré | **débit conservé** (le rendre permettrait un double retrait) | débit rendu | une relance du même retrait reprend **le même volet**, jamais un second débit |

Pour Lightning, la source du virement est celle du rail standard (`Order.stripeChargeId`). Le dernier débit de
l'intention de paiement ne sert que si la commande n'en a pas.

## 5. Opérations manuelles (reprise contrôlée)

- **Lister** : `GET /api/admin/payout-legs` (ADMIN) renvoie les volets `IN_DOUBT` et `PROCESSING`.
- **Adopter** : `POST /api/admin/payout-legs {legKey, action: "reconcile"}`. Cherche dans Stripe et adopte s'il existe
  exactement un virement cohérent (`AuditLog` `payout_leg.adopted`). Ne crée jamais rien. Les écritures du rail
  (tentative, registre comptable) rattrapent au prochain passage du rail (`already_paid`).
- **Confirmer non payé** : `POST … {legKey, action: "confirm_not_paid", note}`. Refusé si le volet n'est pas
  `IN_DOUBT`, si le délai de sécurité n'est pas écoulé, si la recherche Stripe est incomplète, si elle trouve le virement
  ou si un virement non identifié est présent. Sinon `FAILED_CONFIRMED` (`AuditLog`
  `payout_leg.confirmed_not_paid`). Le prochain passage paie sous la génération suivante, après une nouvelle recherche.
- **Règle d'exploitation** : ne jamais remettre à la main une tentative `TRANSFER_IN_DOUBT` en `PENDING` en espérant
  qu'elle repaie. Le registre refusera, et c'est voulu. Passer par les deux actions ci-dessus.

## 6. Rapprochement Affisell ↔ Stripe (lecture seule)

`npm run report:payout-reconciliation` (module pur `lib/payouts/reconciliation.ts`, collecteur
`lib/reports/payout-reconciliation-report.ts`) :

- **Plan (par défaut)** : base seule, dans une transaction `READ ONLY`. Liste les volets en doute, les lignes du registre
  comptable `connect`/`lightning` sans virement, et les références de commande qu'aucun enregistrement ne connaît.
- **`--execute`** : ajoute la liste Stripe des virements créés depuis la fenêtre, avec une clé **restreinte** en lecture.
  `sk_live_` est refusée.
- **Constats** : virement orphelin, doublons pour un volet, virement d'un volet non payé (à adopter), enregistrement
  absent de Stripe (seulement si l'inventaire est complet, avec la réserve de fenêtre), écart de montant, de destination
  ou de rôle.
- Identifiants masqués. **Aucune correction automatique.**
- La production est refusée sans `--confirm-endpoint` (autorisation écrite du fondateur).

**Non exécuté** sur une base réelle ni sur Stripe.

## 7. Preuves

| # | Scénario | Preuve |
|---|---|---|
| 1 | deux workers simultanés, un volet | `payout-leg-registry-db` : 2 puis 5 workers concurrents, un seul appel Stripe |
| 2 | virement créé, réponse perdue | idem : `IN_DOUBT`, relance sans appel, adoption par réconciliation, un virement |
| 3 | arrêt après création, avant enregistrement | idem : bail expiré → `IN_DOUBT` ; le worker « mort » qui revient ne peut pas enregistrer |
| 4 | relance des jours après l'expiration de la clé | idem : virement d'un ancien rail retrouvé et adopté sans création ; réponse perdue puis clés oubliées → rien recréé, confirmation humaine refusée |
| 5 | Lightning après `process-transfers` | idem, vraies fonctions, vraies commandes : 2 virements, jamais 3 |
| 6 | `process-transfers` après Lightning | idem |
| 7 | deux rails simultanés | idem : `Promise.all(Lightning, process-transfers)`, un virement par volet |
| 8 | paramètres différents, même clé | idem : `params_changed`, aucun appel ; refus d'idempotence Stripe → `IN_DOUBT` ; la base refuse l'altération |
| 9 | erreur réseau incertaine | idem : `IN_DOUBT`, confirmation trop tôt refusée, puis génération 2, un virement |
| 10 | refus Stripe confirmé | idem : `FAILED_CONFIRMED` puis génération 2 |
| 11 | conflit du registre après virement (Légion) | idem : `record_failed_after_transfer`, aucun second virement, rien d'écrit à moitié |
| 12 | virement existant adopté | scénarios 2, 3 et 4 |
| 13 | virement orphelin détecté | `payout-reconciliation.test.ts` |
| 14 | aucun chemin ne contourne le service | `payout-leg-single-entry.test.ts` (+ preuve par mutation) |

Autres preuves :
- **Trigger** : chaque transition interdite a été exécutée sur un PostgreSQL 16 local jetable (socket, sans réseau) et
  refusée. Les mêmes refus sont rejoués en CI via Prisma.
- **Migration** : appliquée, annulée (script de retour), réappliquée sans erreur, en local et en CI.
- **Non-régression** : `process-transfers-money-guard` (12), `money-e2e-db`, `money-state-db`,
  `payout-release-dispute-hold`, et la suite complète (8 476 tests).

## 8. Cas historiques (aucune donnée modifiée)

| Cas (audit prod du 2026-11-25) | Ce que fait le registre | Procédure proposée |
|---|---|---|
| 2 virements fournisseur `SUCCESS` de mai 2026 sans ligne au registre comptable | La tentative `SUCCESS` est une preuve : le volet sera **adopté** au premier passage d'un rail, **sans** écrire de ligne comptable (montant non vérifié par le registre) | Lire chaque virement dans Stripe (montant, destination, statut d'annulation). Si conforme, écrire la ligne comptable manquante par un script validé par le fondateur (décision `payout-legacy-backfill`) |
| 3 références `Order.stripeTransferId` inconnues des tentatives et du registre comptable | Volet fournisseur de ces commandes → `IN_DOUBT` (`legacy_order_transfer_reference`) : **rien ne sera payé automatiquement** | `report:payout-reconciliation --execute` sur l'autorisation du fondateur, puis lecture de chaque virement : même volet → adoption (`reconcile`) ; sinon, qualification manuelle |
| 1 commande avec identifiants Lightning sans ligne Lightning au registre comptable | Si ses tentatives sont `SUCCESS` avec ces identifiants : adoption. Sinon `IN_DOUBT` (`legacy_payout_transfer_ids`) | Idem, lecture Stripe puis adoption ou qualification |

Preuves nécessaires pour chaque cas : l'objet virement Stripe (montant, destination, `transfer_group`, métadonnées,
`amount_reversed`), la tentative et la ligne comptable éventuelles, l'historique de la commande. Aucun backfill n'est fait
par ce chantier.

## 9. Déploiement (non fait — décisions du fondateur)

1. Fusionner la PR #11, puis cette branche (après revue).
2. **Appliquer la migration à la main avant le push** :
   `DATABASE_URL='<url>' npm run schema:migrate -- --expect-endpoint <ep>` (staging, puis production avec
   `--confirm-production`).
3. Sans migration, le build Vercel s'arrête à `schema:verify` (migration en attente) et l'ancien code continue de servir.
   Si le code tournait malgré tout sans la table, chaque versement répondrait `registry_unavailable` : rien n'est payé,
   aucune tentative consommée (fermeture par défaut).
4. Après déploiement : `report:payout-reconciliation` (plan) pour voir les volets `IN_DOUBT` issus des traces historiques.
5. `lightningEnabled` peut rester tel quel : A3 est neutralisé par le code (preuve 5, 7). Sa neutralisation en production
   (préparée, bloquée le 2026-11-25) reste une sécurité supplémentaire tant que ce code n'est pas déployé.

**Retour arrière** : préférer revenir au code précédent (table isolée, sans clé étrangère). Le script destructif
`scripts/migration-rollbacks/20261125090000_payout_leg_registry.down.sql` est testé ; avant de l'utiliser, solder à la
main chaque volet `IN_DOUBT` ou `PROCESSING`.

## 10. Limites restantes

- Le faux Stripe des tests reproduit le comportement documenté (idempotence, liste par groupe). **Aucun appel Stripe réel
  n'a été fait.** La forme exacte des erreurs de délai du SDK est classée `IN_DOUBT` par défaut, donc sans risque de
  doublon.
- Cohérence de la liste Stripe : un virement créé il y a quelques secondes pourrait ne pas encore y figurer. C'est couvert
  par la clé (24 h) pendant ce temps, et par le délai de sécurité d'1 h pour la confirmation humaine.
- Une commande **recréée** après une restauration de base a un nouveau groupe : la recherche ne voit pas les virements
  de l'ancienne (voir `docs/BACKUP-RESTORE.md`).
- `transfers.createReversal` (annulations de virement) n'est pas un virement sortant : il reste hors du registre.
