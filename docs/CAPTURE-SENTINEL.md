# Capture Sentinel — active proof that the presence history records changes

Founder brief 2026-11-24, portfolio row 47.

**Built and tested** on the disposable PostgreSQL of the CI and against simulations.

**Never run:** not on staging, not on production, not on any real listing. Every flag stays `off`, and there is no cron.

## 1. The problem it solves

The collection monitor (`docs/COLLECTION-MONITOR.md`) reads what the history already holds. Its limit is that « no new event » means either a quiet shop or a broken capture, and the monitor cannot tell which. It therefore withholds proof (`preuve_insuffisante`).

The passive checks already verify a lot (`report:presence-readiness`):

| Area | What is checked |
|---|---|
| Triggers | Present, correct (definition and function body), enabled |
| Session settings | Replica defaults; the reading session's own setting |
| Coherence | Listing ↔ history reconciliation, chain, duplicates, dates |
| Code | The CI scanner, which forces every code writer to declare its source |

The gap is that **nobody makes a change and watches the event appear**. A function that has the right text but behaves wrongly is invisible to the catalog until real activity reveals it. Examples:
- the time zone is lost through a cast;
- the source declaration is no longer read;
- a second trigger has been added.

## 2. Architecture — a transactional probe

Everything lives in `lib/listing-presence/`:
- `capture-sentinel.ts` (pure): destination rule, steps, evaluation, monitor summary;
- `capture-sentinel-run.ts`: the runner and the residue cleanup.

The runner opens **one** interactive transaction and does the following:

1. Sets the session time zone to `Pacific/Chatham` (+12:45 / +13:45). A capture that forgets the UTC conversion is then off by at least 12 hours and cannot pass.
2. Creates its own synthetic supplier, reseller, product and listing. Every id starts with `capture-sentinel-<run>`. The product is inactive and a draft.
3. Runs **five mutations**, each preceded by the source declaration (`declareListingPresenceSource`, source `capture_sentinel`, actor `sentinel:<run>`). This is the application's own path, through Prisma:

   | Step | Mutation | Expected event |
   |---|---|---|
   | `create` | create the listing, unlisted | `created`, null → false |
   | `list` | `isListed` false → true | `listed`, false → true |
   | `noop` | save without a presence change (position) | **none** (idempotence) |
   | `unlist` | true → false | `unlisted`, true → false |
   | `delete` | delete | `deleted`, false → null |

4. Before and after each mutation, reads the database clock in UTC. After each mutation, reads the events of the test listing.
5. Checks that the listing no longer exists, then **rolls the whole transaction back**.
6. Outside the transaction, counts what survived: listings, events, products, users and price rows of the probe. Every count must be 0.

**Why this design:**
- The cleanup is PostgreSQL's own atomicity, so a forgotten cleanup cannot exist.
- An interrupted probe (crash, killed connection) is rolled back by PostgreSQL itself.
- No real listing is touched.
- No commercial figure can ever count a probe, because nothing commits.
- No second monitoring system is needed: the result goes into the existing snapshots.

## 3. What is proved, and how

**A status code or a transaction that succeeded is never taken as proof.** Every step is judged on the event read back from `ListingPresenceEvent`.

| Check | PASS when | FAIL when |
|---|---|---|
| `mutation:<step>` | the database accepted the mutation | it refused it (and then no event must exist) |
| `evenement:<step>` | exactly the expected event, on the probe's listing, reseller and product | missing, incorrect (kind or states), duplicated, or any event at all for `noop` |
| `provenance` | source `capture_sentinel` and the probe's actor on every event | another source or actor |
| `identification` | every id starts with `capture-sentinel-` | an event outside the probe |
| `utc` | every timestamp lies between the UTC clock read just before and just after its mutation | outside that window (the gap in hours is given) |
| `chaine` | each previous state follows the last recorded state | a break |
| `etat_final` | the listing no longer exists after deletion | it still exists |
| `annulation` | the transaction was rolled back by the probe | UNKNOWN if it was interrupted |
| `isolation` | nothing survives after the transaction | residue counted per table |

**Overall result:**
- **PASS**: every check passed.
- **FAIL**: any check failed.
- **UNKNOWN**: the probe was interrupted or a value was unreadable.
- **NOT_RUN**: destination refused, database unreachable, or migration not applied (`historique_absent`).

The capture delay is the longest gap between a mutation's start and its event, measured inside the transaction (`captureDelayMsMax`).

The result is JSON (`affisell.capture-sentinel`, version 1). It carries the steps and the limits, and `executesAutomatically: false`.

## 4. Isolation — where a probe may run (`decideSentinelDestination`, decided BEFORE any connection)

| Destination | Decision |
|---|---|
| Loopback host + a database name that says « test » (`affisell_test`, `*_tmp`, `ci`, `sentinel`…) + no protected URL matches | **allowed** (`local`, or `ci` under GitHub Actions) |
| Production endpoint (`misty-sea`) | refused, always |
| Staging endpoint (`shy-wind`) | refused: `staging_non_active` (prepared, §5) |
| Any other remote host (other Neon endpoint, IP, domain) | refused: cannot be proved disposable |
| Local database whose name does not say « test » (likely the development database) | refused |
| Same host, port and database as `DATABASE_URL` / `DIRECT_URL` / `DATABASE_URL_STAGING` | refused |
| Vercel deployment, unreadable or missing URL | refused |

**What else holds:**
- A refused destination returns NOT_RUN, and the connection factory is never called (tested).
- A refusal never contains the URL.
- The script adds a second, independent guard on the URL the client will use (`assertNotProductionByAccident`).
- The modules make no network call and read no engine flag (tested).

## 5. Local mode, CI mode, and the staging variant (prepared, NOT executable)

**Local:**
- Run `npm run probe:capture-sentinel` (text) or `npm run probe:capture-sentinel -- --json`.
- It uses ONLY `DATABASE_URL_TEST` from `.env.test.local`. The migration must be applied on that database; otherwise the result is NOT_RUN.
- Exit codes: 0 PASS · 1 FAIL · 2 not run · 3 UNKNOWN.

**CI:**
- `lib/__tests__/capture-sentinel-db.test.ts` runs in the job « Money-path tests on a real PostgreSQL » (disposable database `127.0.0.1/affisell_test`).
- The test checks the destination with the probe's own rule.

**Staging (future, not enabled):** `decideSentinelDestination` recognises staging and refuses it. Enabling it would mean changing that line, which is a founder decision. What the variant needs:

- **Identifying staging without ambiguity:** the endpoint id `ep-shy-wind-…` in the URL, **and** the readiness report's `target` naming the same endpoint. The snapshot it backs must carry that endpoint (the monitor already refuses anything else).
- **Identifying the probe and its data:** the `capture-sentinel-` id prefix, the `capture_sentinel` source, the `sentinel:<run>` actor, and the name `capture-sentinel` on its user and product. The readiness report already counts surviving sentinel listings (`sentinelResidueListings`) and sentinel events (`bySource.capture_sentinel`).
- **Never touching a real listing:** the probe only ever writes to the listing it created inside its own transaction, by id.
- **Isolation, no commercial counting, no interaction with the engines:** nothing commits. Engines, reports and crons in other sessions never see uncommitted rows (READ COMMITTED). The price-history trigger also fires, and is rolled back with everything else.
- **Permissions:** the application role is enough: INSERT, UPDATE and DELETE on User, Product and AffiliateProduct, plus SELECT on ListingPresenceEvent. Better: a dedicated `affisell_sentinel` role with only those rights, in a transaction-mode pool, and its own `DATABASE_URL_SENTINEL_STAGING` secret (to create; secret = founder).
- **Locks:** only rows the probe created. The foreign-key checks lock nothing that exists. The `User.email` unique index sees only the probe's `.invalid` addresses.
- **Never in production:** the production rule refuses before any connection. On top of that, the variable is staging-only and the dedicated role exists only on the staging branch.
- **Interrupted probe or incomplete cleanup:** an interruption is rolled back by PostgreSQL. Residue can only come from a defect. The readiness report and every snapshot then show it as the BLOCKING anomaly `residu_de_sonde`, and `--cleanup` removes it (§8).

## 6. Frequency, cost, stability

**Passive checks already run at every snapshot:** triggers present, correct and enabled, plus replica defaults. Two kinds of fault escape them:
- a function that behaves wrongly while looking right;
- a change that only real activity would reveal.

These come with a **change** (deploy, migration, role or parameter change, maintenance), not with time.

**Recommendation: on demand, never on a timer.**
- Run it right before each snapshot: initial state, J+1, J+7, checks.
- Run it after any deploy, migration or database maintenance.
- Run it whenever a window shows no new event.

A result counts for a snapshot of the **same identified environment** taken within **6 hours** (`SENTINEL_VALIDITY_HOURS`); beyond that it is « expirée ».

**Cost:** a single transaction of about ten statements on rows it creates, taking a few milliseconds. It leaves sequence gaps in event ids, with no meaning. A periodic probe would be cheap, but it adds nothing between two changes. A scheduled task would also need a secret and an authorization, so none is created.

**False positives:** a probe can only fail if a mutation does not produce its event, because it only reads its own listing. Database contention or timeouts give UNKNOWN, never FAIL.

**Lifetime and abandoned probe:** the probe lives only as long as its transaction (30-second timeout). An abandoned probe is rolled back by PostgreSQL and leaves no trace.

## 7. Collection Monitor integration

`report:collection-snapshot -- --sentinel <result.json>` attaches a probe result to a snapshot. `sentinelForSnapshot` turns it into one of these statuses:

| Status | Meaning |
|---|---|
| `confirmee` | PASS, same identified environment (branch + endpoint), within 6 h |
| `echouee` | FAIL, same environment → BLOCKING anomaly `sonde_echouee` (J+1 / J+7 unstable, every engine `anomalie_bloquante`) |
| `inconcluante` | UNKNOWN → minor anomaly, to re-run |
| `expiree` | more than 6 h from the snapshot |
| `non_executee` | no result, or NOT_RUN |
| `environnement_non_verifie` | the probe is not on the snapshot's database (a local or CI probe never vouches for staging) |

The comparison prints a sentence (`captureProof`), for example:
- « collecte fonctionnelle confirmée par sonde »;
- « collecte fonctionnelle mais non testée récemment »;
- « sonde échouée »;
- « environnement non vérifié ».

**What a confirmed probe changes — and only that:**
- The « no new event » anomalies (`aucun_evenement`, `aucun_nouvel_evenement`, `plus_aucune_observation`) stay, but turn into **info** (« activité calme »).
- The J+1 criterion « nouveaux événements », and « progression depuis J+1 » at J+7, are met by a confirmed probe taken after the reference snapshot.
- A criterion `sonde_de_capture` is added. An absent or expired probe adds no criterion, so it never weakens a window with real events.
- **The eight data-maturity dimensions are unchanged** (tested): a probe proves the mechanism, not the data.

**A successful probe does NOT prove:**
- that every real mutation is captured (another session in replica mode, an owner disabling the trigger);
- that every real event is attributed, or that past history is complete;
- that the data is statistically sufficient;
- that an engine can be activated.

Every result says so (`SENTINEL_LIMITS`). The launch gate keeps requiring the J+7 PASS and each engine's own written E authorization.

## 8. Cleanup

**Normal case: nothing to clean**, because the probe always rolls back.

**Residue** can only come from a defect, such as a modified runner or a hand-made row. It is detected:
- by the readiness report (`sentinelResidueListings`, `bySource.capture_sentinel`);
- by the snapshot, as the BLOCKING anomaly `residu_de_sonde`.

**Removal:** `npm run probe:capture-sentinel -- --cleanup` (allowed destinations only). It deletes only rows that carry **both** markers:
- listings with a sentinel id **and** a sentinel product;
- events with source `capture_sentinel` **and** a sentinel listing id;
- price rows with both a sentinel listing and a sentinel product;
- products and users with a sentinel id **and** the name `capture-sentinel`.

A real reseller's row cannot carry both markers.

**How it runs:**
- One transaction: an interrupted cleanup changes nothing (tested) and can be run again.
- It deletes history events with the append-only purge flag, inside that same transaction only.

## 9. Stop conditions

- **Any FAIL on the database a snapshot describes:** the collection is unstable and nothing starts. Find the defect, then restore the trigger or function by re-applying the migration (by hand, with authorization).
- **Residue:** clean it before any analysis.
- **UNKNOWN twice in a row:** look at the database (load, timeouts) before concluding anything.

## 10. Tests

| Kind | File | Covers |
|---|---|---|
| unit + simulated | `capture-sentinel.test.ts` (25) | destination rule (production, staging, unknown, Vercel, development, protected, unreadable — never the URL), no connection when refused, migration absent, every evaluation case (missing, incorrect, duplicate, idempotence, provenance, UTC 13 h, refused mutation, interruption, residue), sentinel source read as technical, monitor statuses / labels, failed probe blocking J+1 and every engine (none executes), quiet window proved or not, dimensions unchanged, absent/expired probe never weakening, residue anomaly, snapshot clean |
| **real PostgreSQL (CI)** | `capture-sentinel-db.test.ts` | healthy PASS + nothing survives + 7 tables unchanged; idempotence (two runs); trigger dropped (missing); local-time function (UTC); wrong reseller / product (incorrect); impossible kind (refused by the table's CHECK → mutation FAIL); source ignored (provenance); second trigger (duplicate); refused mutation; backend killed mid-transaction (nothing left); committed residue detected by the readiness facts then cleaned with the real listing untouched; interrupted cleanup then re-run; same database under another name refused without connecting |

The CI database tests can only be **executed in CI**: this agent environment has no Prisma engine. They are reported as executed only when the CI run of the commit is green.

## 11. Residual risks

- The probe runs in **its own** session. A replica-mode setting in another session, or an owner who disables the trigger between two probes, is caught only by the passive report or a later probe.
- Rolling back means visibility after commit is not measured. A durability fault (replication, disk) is outside the scope.
- The staging variant needs a dedicated role, its own secret and a written authorization. None exists.
- The destination rule trusts the database **name** to say it is disposable, on a loopback host. A development database named `…_test` would be accepted. The probe leaves nothing there anyway.
