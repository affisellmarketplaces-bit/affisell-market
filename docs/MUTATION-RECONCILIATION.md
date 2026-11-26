# Mutation / history reconciliation

Founder brief 2026-11-24, portfolio row 48. Read-only. Tested on fixtures and on the disposable PostgreSQL of the CI. **Never run on staging or production.**

## 1. Question answered

Did a real mutation of a listing's presence happen **without** the history (`ListingPresenceEvent`) recording it?

The passive checks verify the mechanism (`report:presence-readiness`), and Capture Sentinel proves it once, in its own session. The reconciliation confronts the history with **witnesses recorded elsewhere**, which do not depend on the presence trigger.

## 2. Witnesses (`lib/listing-presence/reconciliation.ts`, pure)

| Class | Witness | Why it is independent | Expectation |
|---|---|---|---|
| `creation_prix` | the first base-price row of a listing in `ListingPriceHistory` (variant NULL, previous price NULL) | written by **another trigger**, in the same transaction as the INSERT, whatever the writer | a `created` event exists for that listing |
| `retrait_journalise` | AuditLog `affiliate.listing_replaced` / `affiliate.listing_withdrawn` | written by the replacement flow in the **same transaction** as its withdrawal | the history says « unlisted » after it: either an `unlisted` event within 15 min, or the listing was already unlisted before (consistent, no event due) |
| `etat_courant` | the `AffiliateProduct` rows themselves | they are the result of every mutation | see the three cases below |

For `etat_courant`, there are three cases:
- the current `isListed` must equal the last event;
- a listing created after the start must have a `created` event;
- a vanished listing must end with `deleted`.

The expected **source** of a logged withdrawal is read from `LISTING_MUTATION_REGISTRY` (the entry of that code path). For creations, the expected source is the union of the registry's « create » paths. Nothing is copied, so a registry change is followed automatically.

Event-side anomalies (duplicates, chain breaks, created not first, events after deletion, dates in the future or before the start, inversions) are **not recomputed**: they come from the integrity checks (`eventSide`), so there is one definition.

## 3. Outcomes — never mixed

**Verifiable outcomes (the denominator):**

| Outcome | Meaning |
|---|---|
| `rapprochee` | the expected event exists, with a source the registry declares for that path |
| `coherente_sans_evenement` | nothing had to change (already unlisted). Consistent, but proves nothing about the trigger. |
| `manquante` | a mutation is **proved** and the history does not show it — **confirmed anomaly** |
| `provenance_discordante` | recorded, but with a source the registry does not declare for that path |
| `non_attribuee` | recorded with `unattributed` |

**Not verifiable** (never counted as missing, reason given):

| Reason | Meaning |
|---|---|
| `avant_le_debut` | the witness is before the start, or within the clock margin |
| `etat_anterieur_inconnu` | the state before the mutation is not known |
| `horloge_incertaine` | a matching event exists, but only hours away |
| `source_illisible` | the witness's own table is absent |

## 4. Statistical rules

- **No global score.** Each class gives `numerator / denominator` (denominator = verifiable witnesses), with a 95 % Wilson interval. Below 20 the rate is said to be indicative. The period (from / to) and the clock margin are always given.
- **A capped read** gives no rate and never « no anomaly ». A proved loss still stands, even on a partial read.
- **No witness:** `rien_de_verifiable`, said as « absence de preuve, pas preuve d'absence ».
- **No anomaly:** `aucune_anomalie_sur_le_perimetre_verifie`, stated as valid **for those witnesses and that period only**.
- **Unknown is never 0:** an unread source is `available: false` and `source_illisible`.

**Clock margin:**
- `ListingPriceHistory.effectiveAt` and `AuditLog.createdAt` take `CURRENT_TIMESTAMP` in the **writer's** session time zone.
- The collector reads the time zone a session gets by default (`pg_settings.reset_val`).
- If it is UTC, the margin is 0. Otherwise 14 h are excluded after the start, and a match found only hours away is `horloge_incertaine`.

## 5. Early degradation detection

Dated witnesses (creations and logged withdrawals) are counted per UTC day.

| Pattern | Reading |
|---|---|
| `rupture_datee` | days fully reconciled, then **every** witness lost from a given day: the capture stopped that day |
| `pertes_isolees` | losses mixed with matches |
| `aucune` | no loss on any dated witness |
| `indeterminee` | no dated witness |

`quarantineDays` lists the days with a confirmed loss: no analysis should rely on them. They are **exported, not wired** into the engines; that wiring is a later decision.

## 6. Integration

- **Readiness report:** `report:presence-readiness` runs it in the same READ ONLY transaction (`collectReconciliation`).
  - Check `C_rapprochement_mutations` (**not critical**): BLOCKED on a proved loss, WARN on attribution, PASS when consistent, UNKNOWN when nothing is verifiable. Being non-critical, it does not block the initial report taken before any mutation exists.
  - Counts in `facts.reconciliation`.
- **Snapshots:** `snapshot.reconciliation` (sanitised counts).
- **Anomalies:**
  - `mutations_sans_evenement` (**blocking**, with the first missing day and the number of quarantine days);
  - `attribution_des_mutations` (major);
  - `rapprochement_non_conclusif` (info).
- **Stability:** criterion `rapprochement_mutations`, only when the reconciliation concluded. An absent result never weakens a window.
- **Comparison:** deltas `temoinsVerifiables` and `mutationsSansEvenement`.
- **Engines:** a proved loss blocks every engine's move to observation, through the blocking anomaly.

## 7. Limits

- Only mutations that leave an independent witness are reconciled one by one (creation, logged withdrawal). Other publications and withdrawals are checked only through the current state, which sees the **last** change: an unrecorded round trip between two readings is invisible.
- A listing deleted before any reading and without an original price leaves no witness.
- A writer that sets its own session time zone defeats the margin rule.
- Reads are capped at 200 000 rows per source.

## 8. Tests

| Kind | File | Content |
|---|---|---|
| unit | `mutation-reconciliation.test.ts` (17) | registry reuse; every outcome and every non-verifiable reason; clock margin; attribution; capped read; nothing verifiable; rates; dated rupture vs isolated losses; event side passed through; readiness check; blocking anomaly, unstable J+1, engines blocked, nothing executed; criterion never weakening; comparison deltas; clean snapshot |
| **real PostgreSQL (CI)** | `mutation-reconciliation-db.test.ts` | both triggers installed from their migrations; normal mutations reconcile at UTC margin 0; with the presence trigger **disabled**, a creation, a logged withdrawal and a deletion give 5 confirmed losses of every kind, dated today; the read wrote nothing; the readiness check is BLOCKED and the snapshot carries the blocking anomaly |
