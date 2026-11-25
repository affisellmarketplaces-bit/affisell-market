# Lignée des migrations : origine des tables manquantes et stratégie de réparation (2026-11-24)

> **Investigation menée uniquement sur des bases jetables locales**, par socket local, puis détruites. Aucune connexion au staging ni à la production.
>
> La correction proposée est sur la branche **locale** `local/migration-lineage-fix` (commit `792dd5391`). Elle n'est **pas poussée** : elle attend la décision du fondateur.

## 1. Diagnostic

| | `20260801210000_sponsor_success_fee` | `20260801220000_sponsor_charge_reversed_cents` |
|---|---|---|
| SQL | `ALTER TABLE "SponsorCampaign" ADD COLUMN IF NOT EXISTS "billingMode"…`, `"accruedFeeCents"`, puis `CREATE TABLE IF NOT EXISTS "SponsorCampaignCharge"` avec clés étrangères vers `SponsorCampaign` et `Order` | `ALTER TABLE "SponsorCampaignCharge" ADD COLUMN IF NOT EXISTS "reversedCents"` |
| Dépend de | `SponsorCampaign`, `Order` | `SponsorCampaignCharge` (créée par la précédente) |
| Échec | `relation "SponsorCampaign" does not exist` : **aucune migration ne crée cette table** | **Échec induit** : la précédente ayant échoué (transaction annulée), `SponsorCampaignCharge` n'existe pas. Avec la table de base présente, elle passe. |

**Une seule cause racine** : la table `SponsorCampaign`.

En comparant le schéma construit par la seule chaîne au modèle Prisma, la comparaison table par table, colonne par colonne et index par index révèle **un deuxième trou, silencieux** : la table `AdminAeCaptureSession`, utilisée par `lib/fulfillment/ae-capture-session.ts` (bookmarklet de capture AliExpress côté admin), n'est créée par aucune migration. Il manque aussi l'index `SponsorCampaign_billingMode_status_idx`.

Le reste est identique : 154 tables, toutes les colonnes et les 588 index et clés attendus.

### Faits

- **L'historique Git ne remonte pas plus loin que le 2026-10-05.** Le premier commit, `6e37f0e5d`, importe tout le dépôt d'un bloc : le schéma (avec `SponsorCampaign` déjà présent) et les migrations datées « 20260801 » ensemble.
  - On ne peut donc pas savoir par Git quand la table est apparue dans le modèle.
  - Aucun commit, aucun script et aucun fichier SQL du dépôt (historique compris : `git log -S`) ne contient un `CREATE TABLE "SponsorCampaign"`.
- **Deux mécanismes capables de créer des tables hors chaîne existaient dans ce premier commit** :
  - le script `"db:push": "prisma db push"` (`package.json`). Il aligne une base sur le modèle sans écrire de migration ;
  - le cron d'auto-réparation `/api/cron/migrate`. Il exécutait les fichiers instruction par instruction, ignorait les erreurs « already exists », et `healFailedMigrationHistory` marquait comme terminées des migrations échouées.

  Les deux ont été retirés le 2026-10-08 (`ff02b71b9`).
- **Le dépôt contient déjà un précédent** : `20260529143000_sync_neon_drift` (« schema ahead of replayed migrations »), une migration idempotente de rattrapage de dérive.

### Hypothèse la plus probable (non démontrable par le dépôt)

`SponsorCampaign` et `AdminAeCaptureSession` ont été créées sur les bases partagées par `prisma db push`. Les migrations sponsor ont été écrites ensuite pour une base qui les contenait déjà.

Écartées faute de trace : une migration supprimée (aucune trace, mais l'historique antérieur au 2026-10-05 est absent) et une création SQL manuelle (indiscernable de `db push` sans lire les bases).

**Seule la lecture de `_prisma_migrations` sur une base réelle**, autorisée et en lecture seule, peut confirmer l'origine : présence de la table sans migration correspondante, et dates des lignes.

## 2. Une base neuve peut-elle être reconstruite de façon déterministe ?

Avec le dépôt actuel, **non**. Les quatre objets ne sont pas confondus :

| Objet | Ce qu'il dit |
|---|---|
| **Schéma Prisma** (`schema.prisma`) | La cible : 154 tables |
| **Chaîne des migrations** | Reconstruit 151 tables. Elle s'arrête à la n° 160 si on l'exécute en mode strict. |
| **État réel des bases** | Inconnu depuis cette session. Les tables y existent probablement, puisque le code les utilise. |
| **Historique Prisma** (`_prisma_migrations`) | Inconnu. C'est lui que `migrate deploy` lit pour décider quoi appliquer. |

La CI ne le voyait pas : elle construit son schéma par `prisma migrate diff --from-empty --to-schema-datamodel`, c'est-à-dire depuis le modèle et non depuis la chaîne.

## 3. Stratégies évaluées

| | A. Migrations historiques reconstituées | **B. Migrations correctives protégées (retenue)** | C. Nouvelle base de référence (« baseline ») |
|---|---|---|---|
| Principe | Écrire les migrations « manquantes » telles qu'elles auraient été | Une migration rétro-datée crée `SponsorCampaign` dans sa forme d'avant `20260801210000`. Une migration en fin de chaîne crée l'index et `AdminAeCaptureSession`. Toutes les instructions sont protégées (`IF NOT EXISTS`, contrôle `pg_constraint`). | Remplacer la chaîne par une migration unique tirée du modèle, puis marquer cette référence comme appliquée sur les bases existantes |
| Base vide | Oui, si le contenu est exact | **Oui** : 208 sur 208 et schéma identique au modèle (voir §4) | Oui |
| Bases existantes | Elles verraient de nouvelles migrations à appliquer | **Aucun changement de schéma** (mesuré : écart de 0 ligne) ; Prisma enregistre les deux migrations comme appliquées | Exige d'écrire dans `_prisma_migrations` (`migrate resolve --applied`), **interdit par le dépôt** (un test l'empêche) et risqué |
| Certitude du contenu | **Impossible** : l'historique d'avant le 2026-10-05 est perdu | La forme d'avant le 2026-08-01 est **déduite** du modèle actuel moins ce qu'ajoute `20260801210000`. Le résultat final est vérifié, pas l'histoire exacte. | Pas d'histoire du tout |
| Doublons | Risque si le contenu diffère | Aucun : `IF NOT EXISTS` partout ; contraintes vérifiées par nom | Risque de double application si une base est mal marquée |
| Déploiement progressif | — | Oui : staging d'abord, puis production. Additif. | Non : bascule globale |
| Retour arrière | — | Sur une base existante, il n'y a rien à défaire (rien n'a été créé). Volontairement **pas de `down.sql`** : supprimer ces tables sur une base existante détruirait des données réelles. | Difficile |

**Pourquoi B** : c'est la seule stratégie qui ne réécrit pas l'historique Prisma, qui ne suppose pas un contenu introuvable, et qui laisse les bases existantes inchangées. Elle suit le précédent `sync_neon_drift`.

L'`IF NOT EXISTS` n'y masque aucune dérive : la vérification de dérive devient le contrôle CI du §5.

**Point à valider en CI**, car le moteur Prisma est absent de cette session : la migration rétro-datée arrive *après* des migrations plus récentes déjà appliquées. `prisma migrate deploy` doit l'appliquer comme toute migration non appliquée et l'inscrire une seule fois. C'est attendu, mais pas vérifié ici. Le scénario 4 du contrôle CI le prouve ou l'infirme.

## 4. Vérifications faites localement (PostgreSQL 16 jetable, socket local)

1. **Base vide, chaîne corrigée** : 208 migrations, 0 échec.
2. **Parité avec le modèle** : tables 154/154, colonnes 0 écart, index et clés 588/588.
   - Il reste une seule différence de nom d'index, `SupplierFulfillmentOrderLine_…_ord_key`. Elle vient de la troncature de PostgreSQL à 63 caractères et n'est pas un écart.
3. **Base « historique existant »** : chaîne d'origine, plus les objets créés hors chaîne, puis les deux réparations. **Écart de schéma : 0 ligne.**
   - Cette base et la base vide reconstruite sont identiques. Seul diffère un défaut `now()` / `CURRENT_TIMESTAMP` sur la table créée à la main pour la simulation (artefact du test).
4. **Ré-application** des deux réparations : sans erreur (idempotentes).

**Non vérifié ici** : `_prisma_migrations` écrit par Prisma lui-même, et le diff exact de Prisma (types, valeurs par défaut, clés étrangères). Ces deux points sont confiés à la CI.

## 5. Contrôle CI proposé (`scripts/ci/migration-chain-check.sh`)

Ajouté au job PostgreSQL réel. Il refuse tout hôte non local avant de se connecter.

1. Base vide → `prisma migrate deploy` de toute la chaîne.
2. `prisma migrate diff --from-url <cette base> --to-schema-datamodel --exit-code` : **aucune différence tolérée**. Une chaîne qui ne fonctionne que sur des bases construites hors chaîne échoue ici, avant d'atteindre un environnement partagé.
3. `prisma migrate status` : la base est à jour.
4. Base « historique existant » : ancienne chaîne appliquée par Prisma, objets créés hors chaîne, puis chaîne complète. Le schéma doit rester inchangé, chaque réparation doit être inscrite une seule fois et le statut doit être à jour.

Le retour arrière n'est pas testé pour ces migrations : il n'est pas pris en charge, par conception (voir §3).

## 6. Conséquences

- **Bases neuves** (CI, staging recréé, restauration de secours) : elles deviennent constructibles depuis le dépôt.
- **Staging / production** : deux migrations en attente de plus, sans effet sur le schéma si les objets existent.
  - Si `AdminAeCaptureSession` ou l'index manquent réellement, ils sont créés.
  - **Ce qui est nouveau, c'est que le bookmarklet admin échouerait aujourd'hui sur une telle base** : la table manquante y serait une panne silencieuse, que la réparation corrige.
  - Comme `migrate deploy` applique tout ce qui est en attente, ces migrations partent avec le lot décrit dans `docs/STAGING-MIGRATION-PREFLIGHT.md`.

## 7. Risques non résolus

- L'origine réelle (`db push` ou SQL manuel) reste une hypothèse tant qu'aucune base réelle n'est lue.
- **Une base réelle pourrait porter une forme de `SponsorCampaign` différente du modèle.** `IF NOT EXISTS` la laisserait telle quelle. La comparaison réelle passe par `prisma migrate diff --from-url <base> --to-schema-datamodel`, en lecture seule et sur autorisation.
- Le comportement de Prisma face à une migration rétro-datée doit être confirmé par la CI.
- Le contenu exact de `SponsorCampaign` avant le 2026-08-01 est reconstitué, pas retrouvé. Seul l'état final est garanti.

## 8. Décision

**Prêt pour une correction ciblée**, sous trois conditions :

1. le fondateur valide la stratégie B ;
2. la CI exécute le contrôle (pousser la branche `local/migration-lineage-fix`) et confirme le scénario 4 ;
3. le staging ne reçoit rien avant la lecture en lecture seule prévue par la préparation de la migration.

## 9. Résultat CI et baseline (2026-11-24)

- Preuve CI sur PostgreSQL réel, job « Migration chain replay », PR #10 en brouillon. Résultats :
  - rejeu des 208 migrations ;
  - insertion rétro-datée appliquée par Prisma après des migrations plus récentes, et enregistrée une seule fois ;
  - historique complet inchangé ;
  - historique partiel : seuls `AdminAeCaptureSession`, sa clé primaire et son index sont créés ;
  - tables réparées structurellement identiques au modèle ;
  - seconde exécution sans effet.
- La comparaison complète au schéma Prisma a révélé une dérive **antérieure** à la réparation. Décision du fondateur : la geler dans une baseline stricte, sans migration de rattrapage. Voir `docs/SCHEMA-DRIFT-BASELINE.md`, `prisma/schema-drift-baseline.json` et, pour l'index Stripe, `docs/STRIPE-TRANSFER-UNIQUE-INDEX.md`.
