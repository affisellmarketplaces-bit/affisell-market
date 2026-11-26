# Historique de présence — kit de préparation et d'intégrité

Brief fondateur du 2026-11-24, ligne 42 du portefeuille.

Code :
- `lib/listing-presence/integrity.ts` : module pur ;
- `lib/reports/presence-readiness-report.ts` : collecteur en lecture seule ;
- `scripts/report-presence-readiness.ts` : la commande ;
- migration `20261124090000_listing_presence_history` : **non appliquée**.

## 1. La commande

```
npm run report:presence-readiness -- --static   # dépôt seul, AUCUNE connexion (toujours possible)
npm run report:presence-readiness -- --target   # décrit la base visée, sans connexion
npm run report:presence-readiness               # staging ou base locale seulement, transaction en lecture seule
npm run report:presence-readiness -- --json
```

**Destination**
- La commande ne lit **jamais la production**, même avec `--confirm-endpoint`.
- Elle ne lit jamais une base non identifiée, car on ne peut pas prouver que c'est le staging.
- Le refus intervient **avant toute connexion**. Le rapport statique est alors imprimé à la place.
- La classification se fait sur l'identifiant d'endpoint Neon (`classifyDatabaseUrl`), avant la création du client.

**Lecture seule, deux barrières**
- Transaction `SET TRANSACTION READ ONLY` : PostgreSQL refuse toute écriture.
- Client qui refuse tout sauf `find`, `count`, `aggregate`, `groupBy` et `$queryRaw` paramétré.
- Chaque lecture du catalogue qui pourrait échouer est vérifiée avant d'être lancée (`to_regclass`, version du serveur, droit de lecture). Une erreur annulerait la transaction.

**Sortie**
- Agrégats seulement.
- Ni identifiant, ni chaîne de connexion, ni erreur brute de la base, qui peut contenir l'hôte.

**Codes de sortie** : 0 = PASS/WARN · 1 = BLOCKED · 2 = destination refusée · 3 = UNKNOWN.

**Statuts**
- PASS : vérifié.
- WARN : risque ou limite.
- BLOCKED : une condition indispensable manque.
- UNKNOWN : non vérifiable avec les accès disponibles.

Le résultat global n'est **jamais PASS tant qu'une vérification critique n'est pas PASS**. L'absence de données donne UNKNOWN, jamais zéro.

## 2. Vérifications

| § | Vérification | Critique | Comment |
|---|---|---|---|
| A | Fichier de migration présent | oui | dépôt |
| A | La migration décrit tout le schéma attendu, sans remplissage rétroactif | oui | dépôt : 10 colonnes, 5 contraintes, 3 index, 3 déclencheurs |
| A | Retour arrière complet | non | dépôt |
| A | Migration appliquée | oui | `_prisma_migrations` : appliquée / en échec / annulée / absente / illisible |
| A | Table et champs attendus | oui | `information_schema.columns` |
| A | Contraintes (index manquant = WARN) | oui | `pg_constraint`, `pg_indexes` |
| A | Schéma installé hors procédure | non | table présente sans enregistrement de la migration |
| B/E | 3 déclencheurs : présents, conformes, actifs | oui | `pg_trigger.tgenabled` + `pg_get_triggerdef` + corps de fonction (`pg_proc.prosrc`) |
| B | Capture observée dans les données | oui | types d'événements vus ; état de l'annonce comparé à son dernier événement ; annonces créées après le début sans « created » |
| B | Idempotence, absence de doublons | oui | même annonce, même transition, même instant |
| C | Séquences, dates, frontières | oui | chaîne rompue, « created » non premier, événement après suppression, date future, date antérieure au début, inversions d'horloge (WARN) |
| C | Orphelins et isolation entre revendeurs | oui | annonce disparue sans « deleted », supprimée mais présente, événement attribué à un autre revendeur ou produit |
| C | Événements non attribués | non | part `unattributed` (> 20 % = WARN) |
| C | Historique incomplet (attendu) | non | annonces antérieures (début inconnu), produits réintroduits, remises en vente |
| D | Volumes pour les cinq moteurs | non | `rebuildPresence` + `measurePeriods` + `buildActivationReadiness` : le même code que les moteurs |
| E | Mode réplication | oui | réglages par défaut des rôles et de la base, session du rapport, droit de régler le mode |
| E | Qui peut contourner les protections | non | propriétaire de la table, droit TRUNCATE, superutilisateur |

## 3. Risque TRUNCATE — corrigé

**Constat.** Le déclencheur « ajout seul » s'exécute par ligne. Or PostgreSQL ne lance jamais un déclencheur de ligne sur `TRUNCATE`. Un seul `TRUNCATE "ListingPresenceEvent"` effaçait donc tout l'historique.

**Correctif.**
- Ajout dans la migration, qui n'est appliquée nulle part : la fonction `affisell_listing_presence_no_truncate()` et le déclencheur `ListingPresenceEvent_no_truncate`, en `BEFORE TRUNCATE … FOR EACH STATEMENT`.
- Le retour arrière retire les deux.
- Vérifié sur PostgreSQL 16 local et en CI (`presence-readiness-db`).

**Procédures légitimes.**
- Aucun code ne vide cette table. Les purges utilisent `DELETE` sous l'indicateur `affisell.listing_presence_purge`.
- Pour une maintenance délibérée, dans **une seule transaction** :
  ```
  BEGIN;
  SELECT set_config('affisell.listing_presence_truncate', 'on', true);
  TRUNCATE "ListingPresenceEvent";
  COMMIT;
  ```
  L'indicateur meurt avec la transaction. C'est une décision fondateur, avec une trace écrite.
- Une restauration par `pg_restore --clean` supprime puis recrée la table, sans `TRUNCATE` : elle n'est pas gênée.

**Limites, dites clairement.**
- Le **propriétaire** de la table peut toujours exécuter `ALTER TABLE … DISABLE TRIGGER`.
- Le mode réplique rend ce déclencheur muet, comme les autres (§4).
- Protection complémentaire proposée, hors code, décision d'infrastructure :
  - un rôle applicatif **distinct** du rôle propriétaire qui exécute les migrations ;
  - ce rôle applicatif n'a pas le droit TRUNCATE.

  Aujourd'hui le rapport signale ces deux points en WARN. Il ne peut pas les corriger.

## 4. Mode réplication (`session_replication_role = replica`)

**Quand la capture est désactivée.** Une session réglée sur `replica` n'exécute plus les déclencheurs ordinaires (`tgenabled = 'O'`). Cela vaut pour la capture, l'ajout seul et le refus de TRUNCATE. Restent actifs les déclencheurs réglés `ENABLE ALWAYS` (`A`) ou `ENABLE REPLICA` (`R`). Les écritures faites dans cette session ne laissent **aucun événement**.

**Qui peut le faire.**
- Un superutilisateur.
- Depuis PostgreSQL 15, un rôle qui a reçu `SET` sur ce paramètre.
- Le réglage peut aussi être posé par défaut sur un rôle ou une base (`ALTER ROLE … SET`).

**Où on le rencontre.**
- Certaines restaurations : outils qui chargent les données en mode réplique pour éviter les déclencheurs.
- La réplication logique : le processus d'application de l'abonné tourne en `replica`.
- Des scripts de maintenance.

Il ne s'agit **pas seulement des restaurations**.

**Ce qu'un déclencheur ne peut pas faire.** Il ne peut pas détecter qu'il est lui-même désactivé, puisqu'il ne s'exécute pas. Aucune protection par déclencheur ne couvre ce cas.

**Ce qui est détectable, et que le rapport fait.**
1. Les réglages par défaut d'un rôle ou de la base qui mettent en `replica` (`pg_db_role_setting`) : BLOCKED.
2. La valeur de la session du rapport.
3. Le droit du rôle connecté de régler ce paramètre, ou son statut de superutilisateur : WARN.
4. L'état de chaque déclencheur : `D` désactivé ou `R` réplique seulement donnent BLOCKED.
5. **Après coup**, le rapprochement des annonces avec l'historique :
   - une annonce dont l'état actuel diffère de son dernier événement ;
   - une annonce créée après le début sans événement « created » ;
   - une annonce disparue sans événement « deleted ».

   Chacun de ces cas trahit une capture muette (mode réplique, déclencheur désactivé, `TRUNCATE` sur les annonces, restauration). Le cas est prouvé en CI : une écriture en `replica` ne laisse aucun événement, et le rapport la révèle.

**Ce qui ne l'est pas.** Les réglages des **autres** sessions ne sont pas visibles dans PostgreSQL (`pg_stat_activity` ne les montre pas).

**Surveillance proposée** (non planifiée, décision fondateur) :
- exécuter `report:presence-readiness` sur le staging de façon régulière, par exemple chaque jour pendant les 30 premiers jours de collecte ;
- alerter dès qu'un écart de rapprochement est différent de zéro.

Ne jamais « réparer » en inventant les événements manquants. La fenêtre concernée reste inconnue et ses périodes ne sont pas jugées.

**Option écartée.** `ENABLE ALWAYS` sur les déclencheurs garderait la capture active même en réplique. Mais :
- sur un abonné de réplication logique, cela dupliquerait les événements ;
- cela bloquerait les suppressions répliquées (l'indicateur de purge n'est pas transmis).

À reconsidérer seulement si Affisell n'utilise jamais de réplication logique : décision d'infrastructure.

## 5. Défaut trouvé en chemin — fuseau horaire des événements (corrigé)

**Constat.** Mesuré sur PostgreSQL 16 avec une session réglée sur `Europe/Paris`. `effectiveAt` est une colonne `timestamp(3)` sans fuseau, que Prisma lit comme de l'UTC. Le déclencheur y écrivait `clock_timestamp()`, convertie dans le fuseau de **la session**. Dans une session qui n'est pas en UTC, chaque événement était donc décalé d'une heure, ou deux en été. Le rapport l'a mis en évidence : 4 événements sur 4 apparaissaient « dans le futur ».

**Correctif.**
- La migration écrit désormais `(clock_timestamp() AT TIME ZONE 'UTC')`, quel que soit le fuseau de la session.
- Le rapport compare toutes les dates en UTC.
- Une installation de l'ancienne version de la fonction est signalée « présente mais incorrecte ».
- Test en CI : écriture dans une session `Asia/Tokyo`, instant enregistré en UTC.

## 6. Tests

**`presence-readiness`** : 35 tests unitaires.
- Migration non appliquée, appliquée, en échec ou annulée.
- Déclencheur absent, incorrect (moment, événement, colonne, fonction, corps de fonction, ancienne version), désactivé ou en réplique seulement.
- Protection TRUNCATE absente.
- Mode réplication.
- Séquences anormales, une par anomalie.
- Données manquantes : UNKNOWN et non zéro.
- Isolation entre revendeurs.
- Destination de production ou inconnue refusée, même avec confirmation.
- Rapport sans base.
- La commande : lecture seule, graphe d'imports isolé, aucune erreur brute affichée.

**`presence-readiness-db`** : PostgreSQL réel, en CI.
- TRUNCATE refusé, puis autorisé sous indicateur dans une transaction annulée.
- Ajout seul.
- Fuseau horaire.
- Idempotence et concurrence.
- Déclencheur désactivé, incorrect ou absent, puis réparé par réapplication.
- Écriture en mode réplique, révélée par le rapprochement.
- Anomalies injectées.
- Le rapport n'écrit rien.

## 7. Liste de démarrage de la collecte (le jour de l'autorisation)

La collecte n'autorise **pas** l'activation du copilote : c'est une décision séparée.

| # | Étape | Vérification | Critère |
|---|---|---|---|
| 1 | Conditions préalables confirmées | `report:presence-readiness -- --static` | A1–A3 PASS |
| 2 | Migration examinée | relecture de `migration.sql` (3 déclencheurs, UTC, aucun remplissage rétroactif) | décision fondateur écrite |
| 3 | Risques d'intégrité traités | TRUNCATE (déclencheur), fuseau horaire (UTC), réplique (rapprochement) | ce document |
| 4 | Migration appliquée seulement après autorisation | staging d'abord : `DATABASE_URL='<staging>' npm run schema:migrate -- --expect-endpoint <ep>` | sortie 0 |
| 5 | Schéma vérifié | `npm run schema:verify` + `report:presence-readiness` sur staging | A4–A6 et les 3 déclencheurs PASS |
| 6 | Capture validée | une annonce de test : création, retrait, remise en vente, suppression | 4 types d'événements, 0 écart de rapprochement |
| 7 | Tests de qualité | sections C du rapport | aucune anomalie BLOCKED |
| 8 | Idempotence | réenregistrement sans changement | aucun événement en plus, 0 doublon |
| 9 | Écritures concurrentes | `listing-presence-db` et `presence-readiness-db` verts en CI | vert |
| 10 | Contrôle des premières données | rapport à J+1 et J+7 | 0 écart, part « unattributed » expliquée |
| 11 | Mesure du volume réel | section D | volumes chiffrés, cadence mesurée après ≥ 14 jours |
| 12 | Moteurs maintenus à OFF | les 5 drapeaux du déploiement | tous à off |
| 13 | Nouvelle évaluation des seuils | `GET /api/admin/copilot-blind-spots?readiness=1` | écarts par moteur |
| 14 | Décision d'activation séparée | décision fondateur écrite, par moteur | trace avant tout changement de drapeau |

## 8. État au 2026-11-24

- Rapport exécuté **en mode statique** : A1–A3 PASS ; global **UNKNOWN**, car les vérifications de base n'ont pas été exécutées.
- Staging **non accessible** depuis cette session : aucun identifiant, réseau restreint. Aucune tentative de connexion.
- Production : jamais lue.
- Migration : appliquée nulle part.
