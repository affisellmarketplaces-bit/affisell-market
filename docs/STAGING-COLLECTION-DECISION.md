# Starting the presence-history collection on staging — decision sheet

2026-11-24. This sheet prepares a decision; **nothing in it has been executed**. Each step needs the founder's written authorization (launch gate, `docs/LAUNCH-GATE.md`).

## 1. Recommended decision

**Authorize step B (apply the migration on staging) as one bounded operation, after the three prerequisites of §3.** Then follow §4 to J+7.

**Preflight (2026-11-24, `docs/STAGING-MIGRATION-PREFLIGHT.md`)**: step B applies EVERY pending migration (Prisma has no single-migration apply), the staging migration state is unknown from the agent session, and the chain alone does not rebuild the schema (two sponsor migrations depend on tables created outside migrations). Read the staging state first (§1 of the preflight), read-only, on authorization.

No further control layer is needed before that. What remains unproved can only be proved by real staging data.

## 2. What is proved, and what is not

**Proved on the disposable PostgreSQL of the CI** (tests green on the branch):
- Migration content: append-only, refuses TRUNCATE, UTC timestamps, rollback.
- Every code path that writes a listing is declared in the CI-enforced registry.
- Readiness report (read-only, production refused).
- Snapshots and J+1 / J+7 comparison.
- Capture Sentinel: a controlled mutation produces the exact event; faults are detected.
- Reconciliation: a disabled trigger turns into dated confirmed losses.

**Not proved anywhere:**
- the migration on a real Neon branch;
- the behaviour under real traffic;
- the time zone of staging's sessions;
- the volume of staging activity;
- whether other migrations are pending on staging.

**Never executed:**
- any operation on staging or production;
- any backup or restore exercise (`docs/BACKUP-RESTORE.md` §9 still open).

## 3. Prerequisites (founder side)

1. **Access.** An operator machine with the staging URL (`ep-shy-wind-…`) in an explicit variable, and nothing pointing at production.
2. **Pending migrations — decision needed.** `schema:migrate` applies **every** pending migration, not only the presence history. First list them read-only:

   `DATABASE_URL='<staging>' node scripts/prisma-explicit-db.mjs status`

   Then decide whether the others go in the same operation. Candidates include price history, procurement register, profit alerts, intelligence journal, and the order return terms. Note that **price history is the creation witness of the reconciliation**: without it, creations are not verifiable.
3. **Restore point.** Note the UTC time just before the operation, and check that the staging branch's PITR window covers it. The stop of the collection is « drop the trigger only »; a restore is the last resort (`docs/LAUNCH-GATE.md` §6).

## 4. Procedure once authorized (operator commands)

| # | Step | Command / action | Expected |
|---|---|---|---|
| 1 | Target check | `npm run report:presence-readiness -- --target` | staging, `ep-shy-wind-…` |
| 2 | Apply (authorization B) | `DATABASE_URL='<staging>' npm run schema:migrate -- --expect-endpoint <ep-id>` | exit 0 |
| 3 | Verify | `npm run schema:verify` then `npm run report:presence-readiness -- --json > initial.json` | PASS / WARN; time zone margin shown in `C_rapprochement_mutations` |
| 4 | Initial state | `npm run report:collection-snapshot -- --readiness initial.json --label etat_initial` | snapshot outside the repository |
| 5 | **Generate real activity** | with test accounts on the staging site, perform each of these at least once a day: create a listing, publish it, withdraw it through « Retirer ou remplacer », delete one | witnesses for the reconciliation; new events for J+1 |
| 6 | J+1 (≥ 20 h) | report `--json` → snapshot `J+1` → `report:collection-compare -- --check J+1 --baseline …` | `stable`, reconciliation without loss |
| 7 | J+7 (≥ 156 h) | same with `--check J+7 --j1 …` | `stable` → launch gate step E becomes decidable, engine by engine |

**Why step 5 matters.** Staging has little organic activity. Without mutations, J+1 can only say « preuve insuffisante ». Capture Sentinel cannot run on staging: its staging variant is not enabled and would need a dedicated role and secret. Real test-account actions are therefore the only proof available there.

## 5. Residual risks that really matter

- **Another session in replica mode, or an owner disabling the trigger.** Not prevented. Detected only after the fact by the reconciliation (`etat_courant`, dated losses) and the next snapshot.
- **Staging sessions not in UTC.** A 14 h margin is then applied automatically, and witnesses close to the start become non-verifiable. This delays the proof; it does not make it wrong.
- **Other pending migrations.** Applying them together widens the change; see §3.2.
- **Untested restore procedure.** The collection's own stop does not need it; a bad migration on staging would.
- **The same procedure on production (step D)** remains a separate authorization, after a J+7 `stable` on staging.

## 6. Authorizations to give, in order

1. Access to the staging URL on the operator machine.
2. A decision on the pending-migration list (§3.2).
3. **B**: apply the migrations on `ep-shy-wind-…` — author, date, reason.
4. *(optional, later)* A dedicated `affisell_sentinel` role and secret for the staging Capture Sentinel.
5. After J+7: **D** for production, then **E** engine by engine.
