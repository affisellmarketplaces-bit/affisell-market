# Baseline stricte des divergences historiques du schéma (2026-11-24)

**Décision du fondateur (option 2).** Les divergences historiques entre la chaîne de migrations et `prisma/schema.prisma` sont acceptées **temporairement**, une par une. Il n'y a pas de migration globale de rattrapage. Les divergences seront corrigées plus tard, après vérification des données.

La baseline n'est pas une tolérance : toute divergence qui n'y figure pas est rejetée par la CI.

## Fichiers

| Fichier | Rôle |
|---|---|
| `prisma/schema-drift-baseline.json` | La baseline versionnée (v1) : 20 écarts et 1 contrainte. Chaque entrée porte l'instruction Prisma exacte, le fait de catalogue exact, une justification et un risque. |
| `lib/schema-drift/baseline.ts` | Comparaison pure (aucune base, aucun réseau) : normalisation du diff Prisma, comparaison exacte, rapport. |
| `scripts/ci/check-schema-drift.ts` | Lit deux fichiers (diff Prisma et catalogue), imprime le rapport et l'ajoute au résumé GitHub. `--expect-reject <marqueur>` sert aux tests négatifs. |
| `scripts/ci/schema-catalog.sql` | Lecture seule du catalogue : définition de chaque index, type et défaut de chaque colonne, chaque contrainte CHECK. |
| `scripts/ci/migration-chain-check.sh` | Job CI « Migration chain replay » : scénarios S1 à S4 (réparations) et S5 (tests négatifs). |
| `lib/__tests__/schema-drift-baseline.test.ts` | 15 tests unitaires sur le diff réel de la CI (run 45451931608) et sur les faits de catalogue. |

## Contenu de la baseline v1

| Catégorie | Nombre | Écarts |
|---|---|---|
| Index présents dans la chaîne, absents du schéma Prisma | 8 | `AgentMission_supplierId_urgent_deadlineAt_idx`, `Category_parentId_idx`, `Order_deliveredAtSource_idx`, `Order_trackingLockedAt_idx`, `Product_medusaVariantId_idx`, `ProductRequest_complianceRequirements_idx` (GIN), `ProductRequest_provenanceCountries_idx` (GIN), `ProductRequest_sourceProvenance_idx` |
| Valeurs par défaut non représentées dans Prisma | **4** | `Attribute.updatedAt`, `BookingSlot.updatedAt`, `ChinaBuyRouteLog.updatedAt` (`CURRENT_TIMESTAMP`), `IngNudgeLog.groupsCount` (`0`) |
| Type temporel | 6 | `BookingWaitlist.notifiedAt` / `createdAt` / `smsNotifiedAt`, `Order.bookingReminderHourSmsSentAt` / `bookingSupplierAlertSentAt` / `bookingSupplierDigestSentAt` : `timestamp with time zone` en base, `timestamp(3)` sans fuseau dans Prisma |
| Index unique Stripe | 1 | `MerchantPayoutLedger_stripeTransferId_key`, **partiel** (`WHERE "stripeTransferId" IS NOT NULL`) dans la chaîne. Prisma ne sait pas représenter un index partiel et en réclame un ordinaire. Voir `docs/STRIPE-TRANSFER-UNIQUE-INDEX.md`. |
| Nom d'index tronqué | 1 | `CheckoutLaunchWaitlist_countryIso2_marketRegion_launchNotifiedA` : coupé à 63 caractères, mêmes colonnes |
| Contrainte hors Prisma | 1 | `SponsorCampaignCharge_status_check`, posée par la migration publiée `20260801210000` |

**Deux corrections par rapport au rapport précédent.**

1. Il y a **4** valeurs par défaut et non 5. Le rapport en annonçait 5 mais n'en nommait que 4 ; le diff Prisma n'en contient que 4.
2. L'index Stripe **n'est pas absent** d'une base construite par la chaîne : il existe sous forme partielle. Les deux points sont relus sur le catalogue réel.

**Les « 6 précisions temporelles » sont en réalité des différences de type** (avec ou sans fuseau horaire), et pas seulement de précision. Le risque est noté « moyen » dans la baseline : une lecture SQL directe et Prisma peuvent ne pas lire le même instant.

## Ce que la CI vérifie

Toutes les comparaisons sont **exactes** : aucun motif, aucun joker.

1. **Instructions du diff Prisma.** Chaque clause, une par ligne, doit figurer dans la baseline. Une clause inconnue est une **nouvelle divergence** et fait échouer la CI.
2. **Disparition.** Une entrée que Prisma n'émet plus (écart corrigé, renommé ou changé) fait échouer la CI. On met alors la baseline à jour, avec une justification, dans le même changement.
3. **Faits de catalogue.** Sous chaque instruction acceptée, l'objet réel doit être exactement celui qui est enregistré : définition de l'index, type et défaut de la colonne. Un index recréé sur une autre colonne garde la même instruction `DROP INDEX` ; il est pourtant rejeté, comme **écart existant modifié**.
4. **Contraintes CHECK des tables réparées** (`SponsorCampaign`, `SponsorCampaignCharge`, `AdminAeCaptureSession`). Seule celle qui est listée est admise. Toute autre est rejetée, et la contrainte listée doit être identique.
5. **Protection de la baseline elle-même.**
   - Le fichier est invalide sans justification, sans risque ou sans fait de catalogue. Il l'est aussi s'il contient un identifiant ou une instruction en double, un motif (`*`, `%`, `?`), plusieurs instructions par entrée, une catégorie inconnue ou une contrainte hors des tables vérifiées.
   - Un test unitaire fige le nombre d'entrées par catégorie. Ajouter un écart oblige donc à modifier ce test, ce qui exige une décision explicite.
   - Aucune entrée ne peut viser un objet réparé.
6. **Intégrité des réparations.** Les scénarios S1 à S4 sont inchangés : rejeu des 208 migrations, comparaison structurelle des tables réparées avec le modèle, insertion rétro-datée sur un historique complet et partiel, seconde exécution sans effet.

## Tests négatifs (S5, CI)

Chaque test crée une copie jetable de la base reconstruite par la chaîne, y introduit volontairement une divergence, puis vérifie deux choses : la divergence est **rejetée**, et le rapport la **nomme**. La copie est ensuite supprimée, et le script vérifie qu'il ne reste aucune copie.

| Test | Divergence introduite | Marqueur attendu dans le rapport |
|---|---|---|
| `new_column` | colonne `Order.zz_unexpected` | `zz_unexpected` |
| `new_index` | index `zz_unexpected_idx` | `zz_unexpected_idx` |
| `modified_extra_index` | `Category_parentId_idx` recréé sur `id` | `extra-index-category-parent` |
| `modified_default` | `IngNudgeLog.groupsCount DEFAULT 1` | `default-ingnudgelog-groupscount` |
| `divergence_disappeared` | `Order_trackingLockedAt_idx` supprimé | `DISPARU` |
| `stripe_unique_removed` | index Stripe partiel supprimé | `stripe-transfer-unique-partial` |
| `new_check_on_repaired_table` | CHECK `zz_check` sur `AdminAeCaptureSession` | `zz_check` |
| `repaired_table_changed` | colonne `zz_extra` sur `AdminAeCaptureSession` | `zz_extra` |

Un test négatif **accepté** compte lui-même comme un échec.

## Portée

- Une base construite **uniquement** depuis `prisma/migrations`, en CI.
- **Rien sur le staging ni sur la production**, qui n'ont jamais été lus. Le vérificateur ne lit que des fichiers. Une lecture du catalogue réel du staging ou de la production, autorisée et en lecture seule, pourra donc être jugée par la même baseline sans lui donner aucun accès réseau.

## Procédure pour corriger un écart plus tard

1. Écrire la migration corrective, après vérification des données si elle touche des données.
2. Retirer l'entrée de la baseline dans le même commit, et ajuster le décompte figé dans le test unitaire.
3. La CI doit passer : si l'écart est corrigé, l'entrée retirée n'est plus attendue.
