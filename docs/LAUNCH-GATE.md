# Launch gate — starting the presence-history collection, then observing the engines

Founder brief 2026-11-24 « Historical Data Launch Gate ». Portfolio row 45. **Nothing here has been run on a real database.** The migration is applied nowhere and every flag is `off`.

## 1. The tool

`npm run report:launch-gate` produces **one decision sheet** (`lib/launch-gate/launch-gate.ts`, pure). It does not create a parallel control system: it reuses the existing pieces.

- `report:presence-readiness` checks A–E (schema, capture, integrity, volumes, protection);
- the engine registry and the documented sequence (`lib/reseller-copilot/activation-readiness.ts`);
- the destination classification of the read-only reports (`ReportDatabaseTarget`).

It **never connects to a database**:
- no Prisma client, no connection URL, no network, no migration command, no flag change — pinned by a test that runs it and checks the repository is unchanged;
- by default it reads the repository only (static readiness report);
- `--readiness <file.json>` adds a `report:presence-readiness --json` output already produced by hand on the staging destination;
- `--json` prints the machine-readable sheet.

The sheet sorts everything into six classes: **verified facts**, **test results**, **unknowns**, **hypotheses**, **risks** and **decisions to take**.
- A database fact that was not read is an *unknown*, never a verified fact.
- A test listed as present is not a CI result: read the CI on the target commit.

## 2. Steps and authorizations

Each sensitive step needs **its own written authorization** (`Authorization`: step, endpoint or engine, author, reason). `evaluateStep` checks it and never accepts one in place of another. Every answer carries `executesAutomatically: false`: the sheet says what *may* be run by hand, never runs it, and no step's success authorizes the next one.

| Step | Touches | Authorization | Refused when |
|---|---|---|---|
| **A** Preparation | nothing | none | — |
| **B** Staging migration | the staging database. **Applying it starts capture on staging.** | names the staging endpoint | the destination is production, unknown or local; another endpoint is named; no author or reason; readiness is BLOCKED; A not done |
| **C** Post-migration check | nothing (read-only on staging) | its own | same destination rules; B not observed |
| **D** Start of collection | production. **Applying the migration *is* the start**: there is no other switch. | its own, naming the production endpoint (a B or C authorization never counts) | C not done; staging readiness not PASS/WARN (UNKNOWN is refused) |
| **E** Engine in `observe` | a flag | one per engine | collection not started (for engines that need it); no J+7 check, or a BLOCKED / UNKNOWN one; an earlier engine in the documented order not yet observing; readiness level < 2 |
| **F** Engine `on` | a flag | one per engine, distinct from E | engine not in `observe`; level < 4 (validated on real data); a reseller-facing engine with no control group (> 0 %) |

For F, the contextual horizon reaches resellers through the observation plan. It therefore uses the plan's control group (`HOLDOUT_VIA`), and the plan must be `on` first.

## 3. Engine order and requirements

The observe order is read from `ACTIVATION_SEQUENCE` (`ENGINE_OBSERVE_ORDER`, pinned): **temporal → blind spots → observation plan → retention → contextual horizon**.

Each engine's requirements are its own constants, imported and never copied (`docs/COPILOT-ACTIVATION-READINESS.md`): dependencies, minimum volumes, thresholds, risks and exit conditions. The history each one needs before it can judge (`REQUIRED_HISTORY_DAYS`):

| Engine | History needed |
|---|---|
| Blind spots | 90 days |
| Temporal | 14 days |
| Observation plan | 14 days |
| Retention | 14 days |
| Contextual horizon | 180 days (two halves, each followed 90 days) |

**Collected is not sufficient**: the data-maturity indicator (§7) says whether the data can teach anything, separately from whether the engine can start.

## 4. Historical exposure — coverage made strict

- **Complete coverage** means the history was read in full and began at or before the window start. Under it, unknown time can come only from a missing event.
- **Reliability** has a tolerance of **zero**: one unknown day, or a missing event, and the product or case is not « fiable ». It is then left out of the quality measure and of copilot learning, and the blind-spot detector no longer judges it (`presenceUndocumented` → `donnees_insuffisantes`).
- The former 10 % tolerance could, under complete coverage, only ever admit time made unknown by a missing event. It was removed so that no window holding unknown time is shown as documented.
- **Fallback:** a window that is not covered uses the live-listing estimate, labelled as such, or no result. It is never a mix.
- **Technical coverage is not statistical quality.** That is each engine's floors and §7.
- No correction ever creates a period.

## 5. Infrastructure controls (§6 of the brief)

| Control | How it is checked | State today |
|---|---|---|
| Application role distinct from the migration role, without TRUNCATE | readiness checks E (owner / TRUNCATE privileges) | **unknown**, never read |
| TRUNCATE | refused by the statement trigger unless the maintenance flag is set in the same transaction | proven on PostgreSQL in CI |
| Deleting history | refused unless the purge flag is set in the same transaction | proven in CI |
| Replica mode | role and database defaults are detected; other sessions are **not visible** | live use is only revealed after the fact (checks B/C) |
| Table owner | can `DISABLE TRIGGER`: no trigger protects against its owner | said in the sheet as a risk |
| UTC | `effectiveAt` is written `AT TIME ZONE 'UTC'` | tested in a Tokyo session |
| Attribution | the CI lock covers every known application writer | `unattributed` must stay at 0 on them |

## 6. Stopping — four different operations

| Operation | What it does | Data lost | Engines | How to check it worked |
|---|---|---|---|---|
| Disable an engine | flag back to `off`, no deploy | none (markers stay, inert) | that engine only | its admin route says off; no new marker at J+1 |
| Stop collection | drop **only** the trigger | none deleted, but changes made while stopped are **never** recorded (permanent gap) | set them to `off` | readiness: trigger absent; no event after the stop |
| Roll back the migration | the destructive `.down.sql` (tested) | **every collected event** | all back to « unavailable »; a re-application starts from zero | migration absent |
| Restore data | Neon point-in-time restore **in place** (never exercised) | **the whole database** after that instant (orders, payments, listings) | — | `BACKUP-RESTORE.md` §9 |

A step never uses a restore as its stop. Once production collects, the stop is « stop collection », not the lossy rollback.

## 7. After the start: J+1 and J+7

`postStartCheck` reads the existing readiness report.
- **UNKNOWN** if the report was not read, and never PASS on a static report.
- **BLOCKED** at J+7 when no listing has any history.

Every monitoring question points to an existing report (`OBSERVABILITY_QUESTIONS`): new periods, provenance, `unattributed`, incomplete periods, chronology, triggers, volumes, consistency. No new dashboard.

## 8. Data maturity (additional innovation)

`lib/launch-gate/data-maturity.ts` is pure. It gives eight dimensions per engine, **never a score**: freshness, completeness, provenance, integrity, time coverage, reseller diversity, statistical sufficiency, stability. Each is `satisfaisant`, `insuffisant` or `inconnu` — no data means unknown, never 0 and never ok.

The verdict follows a rule:

| Verdict | Meaning |
|---|---|
| `non_demarrable` | the engine cannot technically start |
| `demarrable_donnees_insuffisantes` | it can start, but at least one dimension is insufficient |
| `maturite_inconnue` | it can start, nothing is insufficient, but a dimension is unknown |
| `donnees_utiles` | every dimension is satisfied — still **not** an activation |

Stability needs two readings. Volumes going backwards are flagged as possible data loss.

## 9. Tests

`launch-gate` (22 tests):
- destinations (production, unknown and local refused);
- separate authorizations (B ≠ C ≠ D, E ≠ F, other endpoint or engine, missing author or reason);
- UNKNOWN treated as not validated;
- dependency order pinned to the sequence;
- no automatic activation, even with every step done;
- stops distinct, with losses said;
- J+1 / J+7 checks;
- sheet classes;
- no secret printed (planted URL and key);
- the script connects to nothing and leaves the repository unchanged;
- data maturity.

`historical-exposure` adds the zero-tolerance cases, including the blind-spot rule.

**Not tested:** any real operation. Nothing was run on staging or production.
