/**
 * Which database a Medusa helper script is about to touch.
 *
 * The Medusa scripts (with-env.mjs → migrations, `medusa user`, seeds; setup-auto.mjs) used to fill a missing
 * DATABASE_URL from the root `.env.local`, which on a developer machine holds the PRODUCTION URL. That is how Medusa's
 * own tables and its admin account were created in the production database (June 2026). Two rules, both fail closed:
 *
 *  1. DATABASE_URL must be set in medusa-backend/.env (or the shell) — never inherited from ../.env.local.
 *  2. DATABASE_URL / DATABASE_URL_PRISMA naming the production endpoint is refused unless the caller names it in
 *     AFFISELL_ALLOW_PRODUCTION_WRITES (the repository's single production-confirmation variable).
 *
 * Messages name variables and a masked host, never a URL or a password.
 */
import { assessProductionByAccident } from "../../../scripts/lib/production-guard.mjs"

export const MEDUSA_DATABASE_VARIABLES = ["DATABASE_URL", "DATABASE_URL_PRISMA"]

/**
 * @param {{
 *   env: Record<string, string | undefined>,
 *   medusaEnvFile: Record<string, string>,   // parsed medusa-backend/.env
 *   parentEnvFile: Record<string, string>,   // parsed ../.env.local ({} when absent)
 *   shellEnv: Record<string, string | undefined>, // the environment BEFORE any file was loaded
 *   tool: string,
 * }} input
 * @returns {{ ok: true } | { ok: false, code: "database_url_inherited" | "production_database", reason: string }}
 */
export function assessMedusaDatabaseTarget({ env, medusaEnvFile, parentEnvFile, shellEnv, tool }) {
  for (const variable of MEDUSA_DATABASE_VARIABLES) {
    const value = String(env[variable] ?? "").trim()
    if (!value) continue
    const fromMedusaFile = String(medusaEnvFile[variable] ?? "").trim() !== ""
    const fromShell = String(shellEnv[variable] ?? "").trim() !== ""
    const fromParent = String(parentEnvFile[variable] ?? "").trim() === value
    if (!fromMedusaFile && !fromShell && fromParent) {
      return {
        ok: false,
        code: "database_url_inherited",
        reason:
          `${tool}: ${variable} would be taken from ../.env.local (the main app's file, possibly production). ` +
          `Set ${variable} explicitly in medusa-backend/.env.`,
      }
    }
  }
  const verdict = assessProductionByAccident({ tool, env, developerMachine: true, urlVariables: MEDUSA_DATABASE_VARIABLES })
  if (!verdict.ok) return { ok: false, code: "production_database", reason: verdict.reason }
  return { ok: true }
}

/** Rule 2 alone, for a script that deliberately copies a URL (validate-tryon-sync). Exits 2 when refused. */
export function assertMedusaNotOnProduction(tool, env = process.env) {
  const verdict = assessProductionByAccident({ tool, env, developerMachine: true, urlVariables: MEDUSA_DATABASE_VARIABLES })
  if (verdict.ok) return
  console.error(`\n✗ [${tool}] REFUSED (production_database): ${verdict.reason}\n`)
  process.exit(2)
}
