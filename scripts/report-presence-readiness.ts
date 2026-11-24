/**
 * READ-ONLY readiness & integrity report of the listing presence history (founder brief 2026-11-24, portfolio row 42):
 * is the history ready to START a reliable collection? Schema installed vs expected, capture triggers present / correct /
 * enabled, the TRUNCATE guard, the replication-role risk, integrity of what was recorded, volumes vs the five copilot
 * engines' thresholds. PASS / WARN / BLOCKED / UNKNOWN; the global result is never PASS while a critical check is not.
 *
 *   npm run report:presence-readiness -- --static     # repository only, NO connection (always possible)
 *   npm run report:presence-readiness -- --target     # describe the database it would read, no connection
 *   npm run report:presence-readiness                 # staging / local database only, read-only transaction
 *   npm run report:presence-readiness -- --json
 *
 * NEVER reads production, not even with --confirm-endpoint, and never an unidentified database (it can not be proven to
 * be staging): the run is refused BEFORE any connection and the static checks are printed instead. Prints aggregates
 * only — no identifier, no connection string, no raw database error.
 * Exit code: 0 PASS / WARN · 1 BLOCKED · 2 destination refused · 3 UNKNOWN.
 */
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { runReadOnlyReport } from "./lib/read-only-report"

import {
  PRESENCE_MIGRATION_NAME,
  buildPresenceReadinessReport,
  formatPresenceReadiness,
  type PresenceReadinessReport,
  type StaticFacts,
} from "../lib/listing-presence/integrity"
import { collectPresenceReadiness } from "../lib/reports/presence-readiness-report"

const asJson = process.argv.includes("--json")
const MIGRATION = path.join("prisma/migrations", PRESENCE_MIGRATION_NAME, "migration.sql")
const ROLLBACK = path.join("scripts/migration-rollbacks", `${PRESENCE_MIGRATION_NAME}.down.sql`)

function staticFacts(): StaticFacts {
  const present = existsSync(MIGRATION)
  return {
    migrationFilePresent: present,
    migrationSql: present ? readFileSync(MIGRATION, "utf8") : null,
    rollbackSql: existsSync(ROLLBACK) ? readFileSync(ROLLBACK, "utf8") : null,
  }
}

function print(report: PresenceReadinessReport) {
  console.log(asJson ? JSON.stringify(report, null, 2) : `\nHistorique de présence — préparation à la collecte — ${report.generatedAt}\n\n${formatPresenceReadiness(report)}`)
  if (process.exitCode === undefined || process.exitCode === 0) {
    process.exitCode = report.global === "BLOCKED" ? 1 : report.global === "UNKNOWN" ? 3 : 0
  }
}

function staticOnly(reason: string) {
  print(buildPresenceReadinessReport({ now: new Date(), staticFacts: staticFacts(), catalog: null, integrity: null, volumes: null, engines: null, databaseNotReadReason: reason }))
}

async function main() {
  if (process.argv.includes("--static")) {
    staticOnly("mode --static : aucune connexion demandée")
    return
  }
  try {
    await runReadOnlyReport(
      {
        tables: ["_prisma_migrations", "pg_catalog (déclencheurs, contraintes, index, réglages)", "ListingPresenceEvent", "AffiliateProduct", "Order", "AuditLog (comptes)"],
        purpose: "préparation et intégrité de l'historique de présence des annonces",
      },
      (tx) => collectPresenceReadiness(tx, { staticFacts: staticFacts() }),
      print,
      { allowProduction: false, onNotRun: (reason) => staticOnly(`destination refusée — ${reason}`) },
    )
  } catch {
    // Never print the raw error: it can carry the host of the connection string.
    process.exitCode = 3
    staticOnly("lecture impossible (connexion ou requête en échec — détail volontairement non affiché)")
  }
}

void main()
