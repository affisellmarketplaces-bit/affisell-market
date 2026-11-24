# Collection monitor — J+1 / J+7 stability of the presence history

Founder brief 2026-11-24 « Historical Collection Monitor ». Portfolio row 46. **Prepared only:** the migration is applied nowhere, so no real snapshot exists. Every engine flag is `off`.

## 1. What it is

The monitor is a pure module (`lib/launch-gate/collection-monitor.ts`) with two scripts. It **only reads files**: no database, no network, no table, no dashboard.

1. On the destination, by hand, produce the readiness report:
   `npm run report:presence-readiness -- --json > rapport.json`.
   - It reads read-only, refuses production, and now records which database it read (`target`).
   - It now also carries the raw counts (`facts`): triggers, events per kind and per source, chronology, newest event (UTC), concentration.
2. Turn it into a snapshot:
   `npm run report:collection-snapshot -- --readiness rapport.json --label etat_initial|J+1|J+7|controle [--activation preparation.json]`
   - `--activation` takes the JSON of `GET /api/admin/copilot-blind-spots?readiness=1`, for data maturity.
   - The snapshot is written to `~/.affisell/collection-snapshots/` with file mode 600. A folder inside the repository is **refused**.
3. Compare two snapshots:
   `npm run report:collection-compare -- --from A.json --to B.json [--check J+1|J+7 --baseline initial.json [--j1 J+1.json]] [--json]`.

## 2. Snapshot format (`affisell.collection-snapshot`, version 1)

**Content:**
- `takenAt` (UTC), `label`, `environment` (branch and endpoint id), `appCommit`;
- `schema`: migration, state, `finishedAt`;
- `global`, `checks` (id, section, status, critical, executed), `triggers` (name, state, defects);
- `protection`: replica mode of the report's own session, replica defaults, owner, TRUNCATE;
- `volumes`, `integrity` (counts only), `activation` (summary), `anomalies`, `limits`.

**Excluded by construction:**
- the checks' free text (evidence);
- any URL, e-mail, key, password or raw error;
- any reseller, product or order identifier.

**How exclusion is enforced:**
- an unknown source is folded into `source_non_reconnue`;
- an endpoint that does not look like `ep-…` becomes `non_identifie`;
- an invalid commit is dropped;
- `assertSnapshotClean` refuses any forbidden content, both when a snapshot is written and when one is read.

## 3. Comparing two snapshots

- **Different environments are never compared.** A different branch or endpoint, or an endpoint that is `non_identifie`, gives `comparable: false`.
- **Different commits** are compared, and the difference is stated.
- **Order and reproducibility:** the two snapshots are ordered by time, and the same inputs always give the same output.
- **Checks:** each check gets a transition: improvement, stable, degradation, unknown or not applicable.
- **Volumes** are **differences only, never a quality verdict**.
- **Anomalies** are listed as new, resolved or persisting.
- **Data maturity:** the **eight dimensions** are kept per engine, each with its own transition, never a score: freshness, completeness, provenance, integrity, time coverage, diversity, sufficiency, stability. Stability is computed against the previous snapshot.

## 4. Anomalies (`detectAnomalies`, each with an explanation and a severity)

| Severity | Anomalies |
|---|---|
| **Blocking** | trigger absent, disabled (`D`), replica-only (`R`) or non-compliant; replica mode by default on a role; history going backwards (fewer events, shorter history — purge, rollback or restore) |
| **Major** | unattributed events; unrecognised source; chain breaks; `created` not first; event after a deletion; dates in the future or before the start (UTC); duplicates; missing periods (a listing created with no `created` event); listing contradicting its history; deleted listing still present; inconsistent attribution; truncated read; no new observation (newest event > 48 h old); no event 24 h after the start; no new event between two readings; fewer finished periods |
| **Minor** | timestamp inversions; listings gone without `deleted`; one reseller carrying more than 60 % of the events; reader role holding TRUNCATE |

**Stated limit:** the settings of *other* PostgreSQL sessions (replica mode) are not visible. Only the after-the-fact reconciliation reveals a write that was not captured.

## 5. J+1 and J+7 stability (`assessStability`)

**Two identical reports are not proof.** A window with no new event, or with facts that were not read, gives `preuve_insuffisante`, never `stable`.

« No new event » can mean a quiet shop just as well as a broken capture. It therefore withholds the proof, but never proves instability on its own (`ACTIVITY_AMBIGUOUS`).

**J+1** is a first technical check, at least 20 h after the start. It needs all of these:
- same environment;
- triggers present, active and compliant;
- report PASS or WARN;
- no blocking anomaly;
- new events since the initial state;
- listings matching their history, and every listing created after the start having its `created` event;
- no new `unattributed` event;
- no chain break, duplicate or inconsistent date.

**J+7** is the stability observation, at least 156 h after the start. It needs everything from J+1, plus:
- the J+1 snapshot, because stability needs two readings after the start;
- progress since J+1;
- no blocking regression since J+1;
- periods rebuilt.

No threshold is derived from volumes: the criteria are facts (present / absent, increased / not increased). How much data the engines need is the job of data maturity, not of stability.

**Verdicts:** `stable`, `instable`, `preuve_insuffisante`, `observation_trop_precoce`, `comparaison_impossible`.

**Link to the launch gate:** `toGateCheckpoint` maps only `stable` to PASS and `instable` to BLOCKED; every other verdict is UNKNOWN. Step E of the gate already refuses anything that is not PASS.

## 6. Moving an engine to observation (`engineObservationDecisions`)

Engines are listed in the documented order: temporal, blind spots, observation plan, retention, contextual horizon. Each gets one status:

| Status | When |
|---|---|
| `anomalie_bloquante` | a blocking anomaly exists, or J+7 is unstable |
| `maturite_inconnue` | J+7 is not stable yet, or a dimension is unknown |
| `dependance_non_satisfaite` | an earlier engine cannot move to observation yet |
| `pret_techniquement` | the collection is stable, but data maturity was not provided |
| `historique_insuffisant` | time coverage is insufficient |
| `donnees_insuffisantes` | diversity, sufficiency, completeness or provenance is insufficient |
| `observation_autorisable_sous_conditions` | everything is satisfied; what remains is the engine's own written E authorization |

Every decision carries `executesAutomatically: false` and names the authorization it needs. Nothing changes a flag.

## 7. Keeping the snapshots

- **Where:** `~/.affisell/collection-snapshots/` by default, or any folder outside the repository. They are operational files and must not be committed.
- **Naming:** `<branch>-<endpoint>-<UTC time>-<label>.json`.
- **What to keep:** the initial state, J+1, J+7 and later checks of the same environment.
- **Automated storage:** a future automatic step (a scheduled run that reads staging, plus shared storage) would need a read access, a secret and an authorization. It is documented here, not built.

## 8. Tests (`collection-monitor`, 22)

- creation and sanitised export, including planted URL, e-mail and key;
- static report means unknown;
- environments refused, commits identified, reproducible ordering, volume differences, eight dimensions;
- regression; provenance, chronology, duplicates, UTC, gaps, mismatches, concentration, triggers, replica defaults;
- missing observation;
- J+1 stable, J+1 without new events, J+1 too early, J+1 on unknown facts, J+1 across environments;
- J+7 without J+1, J+7 without progress, J+7 regression;
- link to the gate;
- engine decisions, dependencies, blocking anomaly;
- scripts: no database, network or migration; snapshot written outside the repository with mode 600; refused inside it; report without destination refused.

`presence-readiness-db` (real PostgreSQL in CI) now also checks the exported facts: counts, newest event in UTC, concentration and triggers.

Nothing has run on staging or production.
