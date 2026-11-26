# Lightning — verrou temporaire (2026-11-25)

**Pourquoi.** Le défaut A3 permettait à Lightning de payer une seconde fois une jambe déjà payée par `process-transfers`.
Le 2026-11-25, la production a été neutralisée par les données (`lightningEnabled = false` sur l'unique fournisseur
concerné). Mais le code de production laisse toujours le fournisseur (`PATCH /api/supplier/lightning-payout`, dès un
score de confiance ≥ 50) ou un admin (`PATCH /api/admin/suppliers/<id>/lightning`) réactiver Lightning.

**Règle** (`lib/payouts/lightning-lock.ts`, lue à chaque appel) : `LIGHTNING_PAYOUTS_MODE` = `locked` (**par défaut**, et
toute valeur inconnue) | `enabled`. Tant que le verrou est actif :

| Chemin | Effet |
|---|---|
| `PATCH /api/supplier/lightning-payout` `{lightningEnabled: true}` | 409 `lightning_locked` + message, rien d'écrit, score non lu |
| `PATCH /api/admin/suppliers/<id>/lightning` `{lightningEnabled: true}` | 409 `lightning_locked` + message, rien d'écrit (dérogation admin comprise) |
| Désactivation (`false`), par le fournisseur ou un admin | inchangée, toujours permise |
| `triggerLightningPayout` (expédition, suivi AfterShip) | `lightning_locked` avant toute lecture : la commande reste `PENDING` et est payée par le flux standard `process-transfers`, même si une ligne dit `true` (SQL, script, ancien déploiement) |
| Page réglages fournisseur / console admin | interrupteur désactivé et message affiché ; refus explicite en cas d'appel |

Aucun autre code n'écrit `lightningEnabled` à `true` (test `lightning-lock` : inventaire des écrivains ; le cron
`refresh-supplier-trust-scores` et la page réglages ne créent que `false`). Le script de dev
`scripts/prepare-lightning-e2e-test.ts` l'écrit mais refuse la production (`assertNotProductionByAccident`), et le
verrou de `triggerLightningPayout` le couvre de toute façon.

**Limite.** Le verrou n'agit qu'une fois **déployé**, avec le correctif A3 de la même PR. Jusque-là, seul le contrôle en
lecture seule protège : `SELECT count(*) FROM "SupplierProfile" WHERE "lightningEnabled";` (attendu : 0).

**Déverrouiller** (`LIGHTNING_PAYOUTS_MODE=enabled` sur Vercel) : décision du fondateur, seulement après déploiement et
vérification du correctif A3 en production. Revenir en arrière = retirer la variable (verrou par défaut).
