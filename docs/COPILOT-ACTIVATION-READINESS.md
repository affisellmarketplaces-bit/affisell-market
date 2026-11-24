# Préparation à l'activation des moteurs du copilote

Brief fondateur du 2026-11-24, ligne 41 du portefeuille.

Code :
- `lib/reseller-copilot/activation-readiness.ts` (module pur) ;
- `activation-readiness.server.ts` (lecture seule) ;
- route admin existante `GET /api/admin/copilot-blind-spots?readiness=1`.

## 0. Ce que ce document établit, et sur quelles preuves

| Preuve | État au 2026-11-24 |
|---|---|
| Code relu (noms, drapeaux, seuils, chemins) | ✅ fait — les seuils du rapport sont les **constantes exportées des moteurs**, importées (jamais recopiées) |
| Tests unitaires et synthétiques | ✅ `copilot-activation-readiness` (22), plus les suites de chaque moteur |
| CI | ✅ sur chaque commit de livraison des moteurs ; ✅/⏳ sur ce commit (voir rapport de livraison) |
| Migration de présence | ❌ **non appliquée**, ni en staging ni en production |
| Staging | ❌ **non accessible** depuis cette session : aucun identifiant, aucune variable de base de données, réseau restreint. Aucune lecture n'a été tentée. |
| Données réelles | ❌ aucune : **tous les volumes réels sont « inconnus »**, jamais zéro, jamais estimés |

Conséquence : les niveaux ci-dessous sont ceux que le code permet d'attester. Ce qui exige des données réelles reste
listé « à vérifier » (§7).

## 1. Les cinq moteurs — état technique vérifié

| Moteur | Drapeau (défaut) | Modes | Groupe témoin | Dépend de la migration | Ce qu'écrit `observe` | Vu par les revendeurs | Tests |
|---|---|---|---|---|---|---|---|
| Blind-Spots Detector | `COPILOT_BLIND_SPOTS_MODE` (off) | off, observe | — | **non** : retombe sur les annonces en ligne (annonces retirées non enregistrées) tant que l'historique ne couvre pas 90 jours | rien | non (admin) | `copilot-blind-spots` |
| Temporal Opportunities Engine | `COPILOT_TEMPORAL_MODE` (off) | off, observe | — | **oui** (`available: false` sinon) | rien | non (admin) | `copilot-temporal` |
| Adaptive Product Observation Plan | `OBSERVATION_PLAN_MODE` (off) | off, observe, on | `OBSERVATION_PLAN_HOLDOUT_PCT` | oui | `copilot.observation_plan`, `copilot.observation_plan_evaluated` | oui, en `on` | `observation-plan`, `observation-plan-db` (PostgreSQL réel, CI) |
| Smart Retention Advisor | `RETENTION_ADVISOR_MODE` (off) | off, observe, on | `RETENTION_ADVISOR_HOLDOUT_PCT` | oui | `copilot.retention_advice` | oui, en `on` | `retention-advisor` |
| Context-Aware Observation Intelligence | `CONTEXTUAL_HORIZON_MODE` (off) | off, observe, on | — (passe par le plan) | oui | `copilot.contextual_horizon_snapshot` (1/jour) | oui, en `on`, via le plan, seulement avec le verdict « meilleur » | `contextual-horizon` |

Défauts connus, aucun bloquant :
- **rétention et plan** : le rang « catégorie » n'est pas mesurable dans ce rapport, car les périodes mesurées ne portent pas la catégorie. Les moteurs, eux, le lisent.
- **conseiller de rétention** : il ne couvre ni le retrait en masse ni la page de remplacement (limite documentée).
- **contextuel** : il n'a pas de groupe témoin propre ; il hérite de celui du plan.

## 2. Données et seuils codés

Tous ces seuils sont les constantes des moteurs. Un seuil marqué *dérivé* combine des constantes ; il est signalé
comme tel dans le rapport (`derived: true`).

| Moteur | Seuils pour juger | Seuils pour valider | Revendeurs |
|---|---|---|---|
| Angles morts | Par produit, sur 90 jours : ≥ 300 jours d'annonce, ≥ 3 revendeurs, ≥ 5 commandes. FDR 10 %. | Boucle de correction ≠ « insuffisante » (deux fenêtres de 45 jours) | ≥ 3 vendeurs, aucun > 60 % des commandes |
| Temporel | Mêmes planchers. Seuil d'observation « plancher » sous 20 premières ventes. | H1/H2 : ≥ 20 périodes et ≥ 5 revendeurs **par côté**. Dérivé : 40 périodes, 10 revendeurs. | 3 / 5 par côté |
| Plan | Rangs : produit 3 revendeurs / 10 ventes, catégorie 5 / 20, général 10 / 50. Part de vente : ≥ 20 issues de ≥ 3 revendeurs. | Calibration : ≥ 20 plans de ≥ 5 revendeurs. Montré / témoin : ≥ 20 cas mûrs par bras. | 10 pour le rang général |
| Rétention | Rangs : produit 3 / 10, catégorie 5 / 20. Ensemble à risque : ≥ 20 périodes de ≥ 3 revendeurs. | ≥ 20 cas mûrs par bras | 3 **autres** revendeurs, soit 4 avec celui qui demande |
| Contextuel | Niveaux : ≥ 20 premières ventes de ≥ 5 revendeurs. Suivi complet de 90 jours. | Moitié récente : ≥ 6 produits, ≥ 30 ventes, z ≥ 2, signe p < 0,05, robuste sans le meilleur produit. Dérivé : ~60 ventes suivies, ~180 jours d'historique. | 5 |

**Volumes disponibles aujourd'hui : inconnus**, car l'historique n'existe pas encore. Le rapport les calculera après la
migration à partir des périodes mesurées par `measurePeriods`, le même code que les moteurs.

Il calculera :
- les périodes, les périodes non jugées et la part censurée (sans vente) ;
- les produits, les revendeurs, et les revendeurs ayant vendu ;
- les premières ventes, et les ventes suivies 90 jours ;
- les produits qui atteignent le rang produit ;
- les produits qui atteignent les planchers des angles morts et du moteur temporel ;
- la part d'événements « unattributed » ;
- la **cadence** (premières ventes par jour), seulement après ≥ 14 jours d'historique et ≥ 5 ventes.

**Durées** : une durée n'est donnée que si tous les manques restants sont des comptes de ventes **et** que la cadence est
mesurée. Sinon le rapport dit « durée inconnue » avec le volume manquant. Les contraintes de calendrier (fenêtre de
90 jours, deux moitiés de 90 jours) s'ajoutent en jours de calendrier.

## 3. Niveaux de maturité aujourd'hui

L'échelle est cumulative ; les dimensions sont montrées à côté, jamais moyennées :
- **0 — Bloqué** : un prérequis dur manque.
- **1 — Implémenté.**
- **2 — Testé.**
- **3 — Données prêtes** : tous les seuils codés sont atteints et la lecture n'est pas tronquée.
- **4 — Validé** : le verdict du moteur lui-même sur données réelles ; il n'est jamais déduit du volume.
- **5 — Activable sous autorisation** : 4, plus chaque moteur précédent dans la séquence est validé.

| Moteur | Technique | Données | Statistique | Niveau | État | Pourquoi |
|---|---|---|---|---|---|---|
| Angles morts | 2 | 2 | 2 | **2 — Testé** | en attente de données | Fonctionne aujourd'hui sur la base « annonces en ligne ». La base « présence » demande 90 jours d'historique. Volumes inconnus. |
| Temporel | 2 | 0 | 0 | **0 — Bloqué** | bloqué | Migration non appliquée. |
| Plan | 2 | 0 | 0 | **0 — Bloqué** | bloqué | Idem. |
| Rétention | 2 | 0 | 0 | **0 — Bloqué** | bloqué | Idem. |
| Contextuel | 2 | 0 | 0 | **0 — Bloqué** | bloqué | Idem. Il demande en plus ~180 jours d'historique. |

Le code des quatre moteurs bloqués est « Testé » (dimension technique 2). Ils sont classés 0 parce que leur seule
source de données n'existe pas encore.

## 4. Fiche par moteur

| Moteur | Dépendance principale | Données disponibles | Seuil | Écart | Revendeurs requis / manquants | Risque | Conditions de sortie | Action suivante |
|---|---|---|---|---|---|---|---|---|
| Angles morts | Historique ≥ 90 jours | Inconnues | 1 produit aux planchers, 90 jours | Inconnu | 3 / inconnu | faible | Base présence ; 1 produit jugé ; boucle ≠ insuffisante | Après la migration, laisser couler 90 jours |
| Temporel | Migration | Aucune | 1 produit aux planchers ; 40 périodes / 10 revendeurs (dérivé) | Inconnu | 3 (5 par côté) / inconnu | faible | Migration vérifiée ; part « unattributed » connue ; H1/H2 jugées | Décision de migration |
| Plan | Migration | Aucune | 50 ventes / 10 revendeurs (général) ; 20 plans | Inconnu | 10 / inconnu | moyen | Observe ≥ 30 jours sans erreur ; calibration cohérente ; témoin en `on` | Idem, puis observe |
| Rétention | Migration | Aucune | 1 produit au rang produit ; 20 à risque ; 40 cas (dérivé) | Inconnu | 4 / inconnu | élevé | ≥ 20 cas mûrs par bras ; témoin en `on` | Idem, après le plan |
| Contextuel | Migration + 180 jours | Aucune | ~60 ventes suivies (dérivé) ; 5 revendeurs ; 30 instantanés | Inconnu | 5 / inconnu | élevé | Verdict « meilleur » ; facteurs stables ; plan validé | Idem, en dernier |

Toutes les durées sont aujourd'hui « durée inconnue », puisque la collecte n'a pas commencé. Seul un minimum de
calendrier est connu :
- 90 jours pour la base présence des angles morts ;
- environ 180 jours pour le moteur contextuel.

## 5. Migration commune `20261124090000_listing_presence_history` — analyse en lecture seule

**Schéma.** La table `ListingPresenceEvent` est en ajout seul :
- colonnes : `kind`, `previousListed`, `newListed`, `source`, `actorId`, `effectiveAt = clock_timestamp()` ;
- contraintes CHECK sur `kind`, sur la forme des booléens, sur `source` (`^[a-z0-9_.:-]{1,64}$`) et sur `actorId` ;
- 3 index : par annonce et id, par produit et date, par revendeur et date ;
- aucune clé étrangère, volontairement : un événement survit à la suppression de l'annonce.

**Déclencheurs.**
- `AffiliateProduct_listing_presence_history` se déclenche AFTER INSERT / UPDATE OF `isListed` / DELETE, FOR EACH ROW.
- Il écrit seulement sur un changement réel (`IS DISTINCT FROM`).
- Une source invalide est **remplacée par `unattributed`**, jamais rejetée : le déclencheur ne peut pas faire échouer l'écriture observée à cause de sa source.
- `ListingPresenceEvent_append_only` refuse toujours UPDATE, et refuse DELETE hors purge déclarée (`affisell.listing_presence_purge = on`).

**Couverture.**
- Les écrivains sont capturés quel que soit le chemin : UI, API, imports, crons, scripts, SQL brut, `COPY`, suppressions en cascade (les déclencheurs ligne s'exécutent aussi en cascade).
- La source déclarée est mesurée par `loadPresenceSourceCoverage`.

**Périodes historiques inconnues.**
- Aucun remplissage rétroactif.
- Une annonce antérieure à la migration a un début **inconnu** (`startKnown: false`). Elle n'est comptée qu'à partir du début de l'historique et n'est jamais jugée par `measurePeriods`.
- Une purge de rétention ramène le début de l'historique à sa limite.

**Cas limites relevés.** Ils ne sont pas couverts par la migration et sont à décider avant de l'appliquer :
1. `TRUNCATE "ListingPresenceEvent"` **contournait** le déclencheur d'ajout seul (déclencheur ligne, pas d'instruction).
   **Corrigé le 2026-11-24** : déclencheur `ListingPresenceEvent_no_truncate` (BEFORE TRUNCATE FOR EACH STATEMENT), voir `docs/PRESENCE-READINESS-KIT.md` §3.
   Ce serait une modification de schéma, donc une décision fondateur.
2. `TRUNCATE "AffiliateProduct"` n'enregistre aucun événement « deleted ». Aucun chemin applicatif ne le fait (à garder ainsi) ; `report:presence-readiness` le révèle après coup (annonces disparues sans « deleted »).
3. `session_replication_role = replica` (certaines restaurations, certains outils de réplication) désactive les déclencheurs : les changements faits ainsi sont invisibles.
   La procédure de restauration (`docs/BACKUP-RESTORE.md`) doit le mentionner. Détection : `report:presence-readiness` (réglages par défaut, état des déclencheurs, rapprochement après coup) — `docs/PRESENCE-READINESS-KIT.md` §4.
4. Ordre : pour une même annonce, l'ordre est sérialisé par le verrou de ligne. Entre annonces, l'`id` reflète l'insertion, pas la validation. C'est sans effet : les périodes sont reconstruites par annonce.
5. Suppression d'un compte revendeur : ses événements sont purgés dans la même transaction (voulu). Ses périodes disparaissent donc des références des autres revendeurs.

**Compatibilité avec les cinq moteurs.**
- Tous lisent l'historique par `loadPresenceForProducts` / `measurePeriods`, une seule définition.
- Les angles morts ne passent à la base « présence » que si l'historique est complet, non tronqué **et** couvre 90 jours.
- Le plafond de lecture est de 200 000 événements. Au-delà, `truncated` est vrai et aucun constat n'est produit ; c'est le premier seuil d'échelle à surveiller.

**Préconditions avant application.** Il faut une décision fondateur, puis :
1. staging d'abord : `DATABASE_URL='<staging>' npm run schema:migrate -- --expect-endpoint <ep>`, puis `schema:verify` ;
2. `npm run report:presence-readiness` sur le staging, sans BLOCKED (le point TRUNCATE est corrigé dans la migration) ;
3. `listing-presence-db` vert en CI (PostgreSQL réel) ;
4. les cinq drapeaux restent à off ;
5. la production seulement après la liste de contrôle du §6 passée en staging ;
6. le push du code qui en dépend vient après la migration.

**Après application.** Appliquer la liste de contrôle du §6.

**Ne jamais simuler d'historique** : aucun remplissage, aucune date inventée.

## 6. Liste de contrôle post-migration

La **collecte** et l'**activation d'un moteur** sont deux décisions distinctes. Cette liste vérifie la collecte ;
elle n'active rien.

| # | Étape | Vérification | Critère de passage |
|---|---|---|---|
| 1 | Intégrité du schéma | `schema:verify` ; table, CHECK, index, déclencheurs présents | sortie 0 |
| 2 | Mécanismes de capture | Annonce de test en staging : création, retrait, remise en vente, suppression | un événement par changement réel |
| 3 | Nouveaux événements | `SELECT kind, count(*) … GROUP BY kind` (staging, lecture) | des événements au rythme des changements |
| 4 | Idempotence | Réenregistrement sans changement de `isListed` | aucun événement de plus |
| 5 | Concurrence | `listing-presence-db` en CI | sérialisé, rien perdu ni doublé |
| 6 | Isolation des revendeurs | `GET /api/affiliate/listings/<id>/presence` depuis un autre compte | 404, aucun `actorId` |
| 7 | Qualité des données | `presenceSources.unattributedShare`, périodes non jugées | part mesurée et expliquée |
| 8 | Premiers volumes | `?readiness=1` | cadence mesurée après ≥ 14 jours |
| 9 | Comparaison aux seuils | écarts (`gaps`) par moteur | manques chiffrés |
| 10 | Moteurs pouvant observer | séquence du §8 | un moteur à la fois, par sa porte |
| 11 | Drapeaux maintenus off | `modes` du rapport | tous off |
| 12 | Décision d'activation séparée | décision fondateur écrite, par moteur | trace avant tout changement de drapeau |

## 7. Ce qui reste à vérifier, et ne peut pas l'être ici

- **Staging** :
  - application de la migration ;
  - étapes 1 à 7 de la liste de contrôle ;
  - volumes réels ;
  - part « unattributed » réelle ;
  - nombre d'événements et risque d'atteindre 200 000.
- Le comportement réel de `loadTemporalInputs` à l'échelle : 5 000 produits, 200 000 commandes.
- La cadence réelle de premières ventes, qui seule permettra des durées.

## 8. Séquence d'activation progressive

Jamais les cinq ensemble. Chaque retour arrière est un drapeau lu à chaque requête, sans déploiement.

| Ordre | Étape | Porte d'entrée | Point de contrôle | Retour arrière | Pourquoi à cette place |
|---|---|---|---|---|---|
| 0 | Migration (**collecte seulement**) | Décision fondateur ; staging ; `schema:verify` ; liste §6 étapes 1–9 | J+1, J+7 | Revenir au code ; ou supprimer seulement le déclencheur ; SQL destructif testé | Aucun moteur ne voit d'historique sans elle ; rien ne change pour les utilisateurs |
| 1 | `COPILOT_TEMPORAL_MODE=observe` | Lecture non tronquée ; part « unattributed » connue | Rapport lisible, pas de 503 | `off` | Lecture seule, vue fondateur : premier contrôle réel de la qualité de l'historique |
| 2 | `COPILOT_BLIND_SPOTS_MODE=observe` | Étape 1 propre ; base présence à 90 jours | `exposureBasis` | `off` | Lecture seule, vue fondateur |
| 3 | `OBSERVATION_PLAN_MODE=observe` | Étapes 1–2 stables ≥ 7 jours | Plans et silences par motif | `off` ; marqueurs inertes | Enregistre sans montrer : la calibration se fait avant tout affichage |
| 4 | `RETENTION_ADVISOR_MODE=observe` | Étape 3 sans erreur ≥ 14 jours | Cas par bras | `off` | Touche la décision de retrait, l'enjeu le plus élevé |
| 5 | `CONTEXTUAL_HORIZON_MODE=observe` | Historique ≥ 180 jours | Verdict, dérive | `off` | Le plus exigeant en données |
| 6 | `on` **un moteur à la fois** (plan, puis rétention, puis contextuel), avec `HOLDOUT_PCT` 10–20 | Niveau 4 dans ce rapport ; décision fondateur distincte par moteur | Montré / témoin ≥ 20 cas mûrs par bras | Repasser en `observe` ou `off` | Seule étape visible des revendeurs |

## 9. Lecture du rapport

`GET /api/admin/copilot-blind-spots?readiness=1` (ADMIN) renvoie `{ readiness }`, en cache 6 h. Il contient :
- `data` : les agrégats ;
- `engines[]` : dimensions, niveau, état, écarts, revendeurs, durée et sa base, risque, conditions de sortie, action suivante, tests nécessaires ;
- `sequence`, `checklist`, `limits`.

Le rapport respecte ces règles :
- Lecture seule ; il ne recalcule jamais le paquet contextuel, qui écrirait un instantané.
- Le verdict contextuel est lu dans le dernier instantané **enregistré**, de la même version de modèle.
- Il ne contient aucun identifiant de produit, revendeur, acheteur ou commande.
- Il ne lit rien de lourd tant que la migration n'est pas appliquée.
- Sans le paramètre, la route est inchangée.
