/**
 * Fiche de décision — démarrage contrôlé de la collecte de l'historique de présence (lib/launch-gate/launch-gate.ts).
 *
 *   npm run report:launch-gate                                   # dépôt seulement, AUCUNE connexion
 *   npm run report:launch-gate -- --readiness <fichier.json>     # + un rapport report:presence-readiness --json déjà produit
 *   npm run report:launch-gate -- --json
 *
 * Ne se connecte à AUCUNE base, ne lit aucune URL de connexion, n'exécute aucune migration, ne change aucun drapeau.
 * Les drapeaux sont affichés normalisés (off / observe / on…), jamais leur valeur brute.
 */
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { buildPresenceReadinessReport, PRESENCE_MIGRATION_NAME, type PresenceReadinessReport } from "../lib/listing-presence/integrity"
import { buildLaunchDecisionSheet, formatLaunchDecisionSheet, readFlagStates } from "../lib/launch-gate/launch-gate"

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
}

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5_000 }).trim()
  } catch {
    return null
  }
}

function staticReadiness(): PresenceReadinessReport {
  const migration = path.join("prisma/migrations", PRESENCE_MIGRATION_NAME, "migration.sql")
  const rollback = path.join("scripts/migration-rollbacks", `${PRESENCE_MIGRATION_NAME}.down.sql`)
  return buildPresenceReadinessReport({
    now: new Date(),
    staticFacts: {
      migrationFilePresent: existsSync(migration),
      migrationSql: existsSync(migration) ? readFileSync(migration, "utf8") : null,
      rollbackSql: existsSync(rollback) ? readFileSync(rollback, "utf8") : null,
    },
    catalog: null,
    integrity: null,
    volumes: null,
    engines: null,
    databaseNotReadReason: "fiche de décision : aucune base lue",
  })
}

function main() {
  const file = arg("--readiness")
  let readiness = staticReadiness()
  if (file) {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as PresenceReadinessReport
      if (!Array.isArray(parsed.checks) || typeof parsed.global !== "string") throw new Error("shape")
      readiness = parsed
    } catch {
      console.error("Fichier --readiness illisible ou d'un autre format (attendu : sortie de report:presence-readiness -- --json).")
      process.exitCode = 2
      return
    }
  }
  const head = git(["rev-parse", "HEAD"])
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"])
  const remote = branch ? git(["rev-parse", `origin/${branch}`]) : null
  const clean = (git(["status", "--porcelain"]) ?? "x") === ""
  const sheet = buildLaunchDecisionSheet({
    now: new Date(),
    git: head && branch ? { branch, head, remoteHead: remote, clean } : null,
    readiness,
    readinessFromFile: Boolean(file),
    activation: null,
    flags: readFlagStates(process.env),
    state: { outcomes: { A: readiness.global === "BLOCKED" ? "echec" : "fait" }, engineModes: {}, engineLevels: {}, daysSinceCollection: null, checkpoints: { j1: null, j7: null }, readinessGlobal: readiness.global },
    auths: [], // authorizations are never read from the environment: they are written decisions, recorded apart
  })
  console.log(process.argv.includes("--json") ? JSON.stringify(sheet, null, 2) : formatLaunchDecisionSheet(sheet))
}

main()
