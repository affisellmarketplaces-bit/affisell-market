/**
 * Which database a READ-ONLY report would read, and whether it may run (founder rule 2026-11-18: no report touches the
 * production database without his explicit authorisation).
 *
 * Pure. The scripts feed it what `classifyDatabaseUrl` (scripts/schema-deploy.mjs) says about DATABASE_URL — masked
 * host, Neon endpoint id, branch — and which file the URL came from. Nothing here ever holds a password: the target is
 * described by the endpoint id and the masked host only.
 *
 * Rule: `--target` only describes and exits (no connection). A run on a database that is PRODUCTION, or that can not be
 * shown NOT to be production (`unknown`), needs `--confirm-endpoint=<endpoint id>` naming that very endpoint — the
 * written trace of the authorisation. Staging and local databases run without it.
 */

export type ReportDatabaseTarget = {
  /** Where DATABASE_URL came from, in the order dotenv applies them (the first one wins). */
  source: "shell" | ".env.local" | ".env" | "absent"
  endpoint: string
  branch: "production" | "staging" | "local" | "unknown"
  maskedHost: string
}

export type ReportRunDecision =
  | { action: "describe" }
  | { action: "run"; confirmed: boolean }
  | { action: "refuse"; reason: string }

export function decideReportRun(args: {
  target: ReportDatabaseTarget
  targetOnly: boolean
  confirmEndpoint: string | null
}): ReportRunDecision {
  if (args.targetOnly) return { action: "describe" }
  const { target } = args
  if (target.source === "absent") return { action: "refuse", reason: "DATABASE_URL absente : aucune base à lire." }
  if (target.branch === "staging" || target.branch === "local") return { action: "run", confirmed: false }
  const confirm = (args.confirmEndpoint ?? "").trim().toLowerCase()
  if (!confirm) {
    return {
      action: "refuse",
      reason:
        target.branch === "production"
          ? `base de PRODUCTION (${target.endpoint}) : relancer avec --confirm-endpoint=${target.endpoint} une fois l'autorisation donnée.`
          : `base non identifiée (${target.maskedHost}) : impossible de prouver que ce n'est pas la production — --confirm-endpoint=${target.endpoint} requis.`,
    }
  }
  if (confirm !== target.endpoint.toLowerCase()) {
    return { action: "refuse", reason: `--confirm-endpoint ne nomme pas la base ciblée (${target.endpoint}).` }
  }
  return { action: "run", confirmed: true }
}

/** The lines every report prints BEFORE reading anything (and that `--target` prints alone). */
export function describeReportTarget(target: ReportDatabaseTarget, scope: { tables: string[]; purpose: string }): string[] {
  const env =
    target.branch === "production"
      ? "PRODUCTION"
      : target.branch === "staging"
        ? "staging (branche Neon de préproduction)"
        : target.branch === "local"
          ? "base locale"
          : "NON IDENTIFIÉE (traitée comme production)"
  return [
    `Rapport : ${scope.purpose}`,
    `Base ciblée : ${target.maskedHost} — endpoint ${target.endpoint} — environnement ${env}`,
    `Origine de DATABASE_URL : ${target.source}`,
    `Tables lues : ${scope.tables.join(", ")}`,
    "Lecture seule : transaction PostgreSQL « SET TRANSACTION READ ONLY » + client qui refuse toute opération autre que find/count/aggregate/groupBy avant la base.",
    "Aucune écriture, aucune migration, aucun appel externe, aucune donnée personnelle affichée (agrégats uniquement).",
  ]
}
