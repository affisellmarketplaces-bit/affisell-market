# PR #13 — déploiement, vérification, retour arrière, intégration avec #9 / #12

État au 2026-11-25. **Rien de ce document n'a été exécuté** : chaque étape marquée [fondateur] demande ton autorisation.

## 0. Ce que la PR change en production

- Correctif A3 : Lightning ne paie plus une jambe déjà payée, réserve la commande avant Stripe, partage la clé
  d'idempotence de `process-transfers`, enregistre chaque jambe aussitôt, garde une commande incertaine en `PROCESSING`.
- Verrou `LIGHTNING_PAYOUTS_MODE` : **verrouillé tant que la variable n'existe pas** ; seul le mot exact `enabled`
  déverrouille. Fournisseur et admin ne peuvent plus activer Lightning (409 `lightning_locked`) ; aucun paiement Lightning.
- `process-transfers` : n'écrase plus une jambe enregistrée `SUCCESS` par un autre rail.
- **Aucune migration, aucune variable à créer.** Le déploiement ne demande rien d'autre que le code.

Important : `vercel.json` a `git.deploymentEnabled: true` → **merger dans `main` déclenche le déploiement production**.
Merger = déployer.

## 1. Déblocage Vercel [fondateur]

1. Vercel → Settings → Invoices : régler la facture en attente (statut « Account is blocked » sur les PR).
2. Vérifier que le statut « Vercel » d'une PR repasse à `pending` puis `success` (preview) — par exemple en relançant la
   preview de la PR #13 (bouton « Redeploy » sur sa preview, ou un commit vide n'est PAS nécessaire).
3. Vérifier qu'**aucune** variable `LIGHTNING_PAYOUTS_MODE` n'existe dans Settings → Environment Variables
   (Production, Preview, Development). Si elle existe : la supprimer **avant** le merge.

## 2. Merge et déploiement [fondateur]

1. PR #13 : passer de brouillon à « Ready », vérifier CI verte (`lint-and-unit`, `lightning-db-tests`, Preview check ;
   Lighthouse peut échouer sur le budget LCP sans lien avec la PR — relancer une fois).
2. Merge (merge commit, pas de squash nécessaire). Le déploiement production démarre automatiquement.
3. Attendre « Ready » sur le déploiement production ; noter son identifiant et celui du déploiement précédent
   (commit `c593b698c`) pour le retour arrière.

## 3. Vérification du verrou en production (lecture ou refus, rien d'écrit)

1. **Base, lecture seule** (console Neon, branche `production`) :
   `SELECT count(*) FROM "SupplierProfile" WHERE "lightningEnabled";` → attendu **0**.
2. **Variable** : Vercel → Environment Variables → `LIGHTNING_PAYOUTS_MODE` absente (= verrouillé).
3. **Refus effectif** [fondateur, action sans effet] : connecté en admin, `/admin` → Lightning fournisseurs → tenter
   d'activer un fournisseur → message « Lightning Payout est temporairement suspendu… », la ligne reste désactivée.
   Le refus intervient avant toute écriture.
4. **Journaux** (Vercel → Logs) : une ligne `[admin-lightning] refused_locked` pour l'essai du point 3 ; aucune ligne
   `[lightning-payout]` de paiement.
5. Refaire le point 1 → toujours 0.

## 4. Contrôle continu jusqu'au déverrouillage

- Hebdomadaire : requête du §3.1 (0 attendu) et absence de la variable.
- Toute commande restée `payoutStatus = 'PROCESSING'` = transfert incertain d'avant le correctif : **ne jamais la remettre
  en `PENDING` sans avoir vérifié dans Stripe** (Dashboard → Connect → Transfers, groupe = id de la commande).
- Déverrouiller (`LIGHTNING_PAYOUTS_MODE=enabled`, valeur exacte) = décision séparée, après §3 validé et, idéalement,
  après l'adoption du registre de la PR #12.

## 5. Retour arrière

| Problème | Action | Effet |
|---|---|---|
| Erreur applicative après déploiement | Vercel → Deployments → déploiement précédent (`c593b698c`) → « Instant Rollback » | Code d'avant restauré en ~1 min. **Le verrou disparaît** : refaire §3.1 chaque semaine jusqu'à un nouveau déploiement |
| Un paiement standard bloqué | Aucun lien attendu avec le verrou (il n'agit que sur Lightning) ; examiner `process-transfers` | — |
| Lightning activé par erreur | Supprimer `LIGHTNING_PAYOUTS_MODE` ; mettre `lightningEnabled = false` (écriture à autoriser) | Verrou rétabli à la requête suivante |

Aucune donnée n'est migrée : le retour arrière est complet côté code, sans rien à défaire en base.

## 6. Intégration avec les PR #9 (release) et #12 (registre des jambes) — essai réalisé le 2026-11-25

Fusion d'essai dans un worktree jetable, rien de poussé.

**#13 dans `release` (PR #9)** : un conflit, `lib/transfers/process-transfers.ts`. `.github/workflows/ci.yml`
conflictera aussi (les deux ajoutent un job base réelle).

**#13 dans #12** : trois conflits, `lib/stripe-lightning.ts`, `lib/transfers/process-transfers.ts` et
`.github/workflows/ci.yml`.

Résolution vérifiée sur l'arbre intégré (69 tests au vert : `lightning-lock`, `lightning-lock-trigger`,
`process-transfers-money-guard`, `payout-leg-model`, `payout-leg-single-entry`, `payout-reconciliation` ; aucune erreur
de types sur ces fichiers) :

1. Prendre la version de #12 pour `stripe-lightning.ts` et `process-transfers.ts` (le registre remplace la logique A3).
2. Y remettre les trois gardes de #13 :
   - `triggerLightningPayout` : `if (isLightningLocked()) return { success: false, reason: "lightning_locked" }` en
     première instruction (+ import `@/lib/payouts/lightning-lock`) ;
   - `process-transfers`, gestion d'erreur : `transferAttempt.updateMany({ where: { id, status: "PENDING" } … })` au lieu
     de `update({ where: { id } })` ;
   - `process-transfers` : ignorer une commande `payoutStatus === "PROCESSING"` (laissée par Lightning A3), après le test
     `PAID`.
3. Supprimer `lib/__tests__/lightning-a3-hotfix.test.ts` et `lib/__tests__/lightning-a3-db.test.ts` (ils testent les
   internes A3 — `PROCESSING`, alerte « IN DOUBT » — que le registre remplace ; `payout-leg-registry-db` couvre Lightning
   et `process-transfers` sur de vraies commandes). **Garder** `lightning-lock-trigger.test.ts` : il ne dépend pas de l'implémentation et
   échoue si l'intégration perd le verrou.
4. `ci.yml` : garder la version de #12 (job `money-db-tests`) ; ne pas reprendre le job `lightning-db-tests`.

Ordre recommandé : #13 en production d'abord (seul correctif urgent, aucune migration) ; puis #9 → #11 → #12 avec la
résolution ci-dessus, migrations appliquées sur staging puis production (`docs/PAYOUT-ADOPTION-PLAN.md`, sur #12).
