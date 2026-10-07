/**
 * "Production by accident" guard for developer tools.
 *
 * On a developer machine `.env` / `.env.local` hold the PRODUCTION database URL (and `@prisma/client` loads `.env` on its own), so a
 * backfill, a seed, a `verify-*` smoke test or `clear-products.ts` — launched from a laptop — acts on production without anyone
 * having said so. This is how a unit test wrote fake AliExpress tokens into production (see vitest-env/no-real-datastores.ts).
 *
 *   developer machine  +  a database URL that names the PRODUCTION endpoint  +  no explicit confirmation   →   HARD FAIL (exit 2)
 *
 * Explicit confirmation, for a tool you really mean to run against production:
 *     AFFISELL_ALLOW_PRODUCTION_WRITES=ep-misty-sea-al1ne07p  npm run <tool>
 * (the endpoint id: several, comma-separated; `redis` for the shared Redis). It must name the endpoint — a bare `1` is not enough.
 *
 * "Developer machine" = a secret-bearing env file is present in the repository (see DEVELOPER_ENV_FILES in build-isolated.mjs).
 * Gitignored and never committed, so a production host (Vercel, Railway) or CI never has one: the guard is inert there.
 *
 * Used by every standalone script that creates its own Prisma client (an invariant test fails when a new one does not call it),
 * by the Prisma CLI (prisma.config.ts) and by the auto-order worker. Application code that goes through `lib/prisma.ts` is covered
 * by lib/developer-production-guard.ts instead.
 */
import { fileURLToPath } from "node:url"

import { hasDeveloperEnvFiles } from "../build-isolated.mjs"
import { normalizeEndpoint } from "../prisma-explicit-db.mjs"
import { classifyDatabaseUrl } from "../schema-deploy.mjs"

export const ALLOW_PRODUCTION_WRITES_VARIABLE = "AFFISELL_ALLOW_PRODUCTION_WRITES"

/** Every variable through which a Prisma client may be pointed at a database. */
export const DATABASE_URL_VARIABLES = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "DIRECT_URL",
  "RADAR_DATABASE_URL",
  "MARKET_INTELLI_DATABASE_URL",
]

/** Redis variables (a remote one on a developer machine is the shared production queue / cache). */
export const REDIS_URL_VARIABLES = ["REDIS_URL", "UPSTASH_REDIS_REST_URL"]

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[?::1\]?)$/i

/**
 * The root of this repository, whatever the working directory of the tool. Resolved lazily and defensively: this module is also
 * loaded by Prisma's own config loader (prisma.config.ts), where `import.meta` is only partly available.
 */
function repoRoot() {
  try {
    return fileURLToPath(new URL("../..", import.meta.url))
  } catch {
    return process.cwd()
  }
}

/** @param {string | undefined} value @returns {Set<string>} the endpoints the caller has explicitly confirmed */
export function parseConfirmation(value) {
  return new Set(
    String(value ?? "")
      .split(/[\s,]+/)
      .map((token) => normalizeEndpoint(token))
      .filter(Boolean)
  )
}

/**
 * @param {{
 *   tool: string,
 *   env: Record<string, string | undefined>,
 *   developerMachine: boolean,
 *   urlVariables?: string[],
 *   redis?: boolean,
 * }} input
 * @returns {{ ok: true, active: boolean, confirmed: string[] } | { ok: false, reason: string, exposures: Array<{ variable: string, endpoint: string, maskedHost: string }> }}
 */
export function assessProductionByAccident({ tool, env, developerMachine, urlVariables = DATABASE_URL_VARIABLES, redis = false }) {
  if (!developerMachine) return { ok: true, active: false, confirmed: [] }

  /** @type {Array<{ variable: string, endpoint: string, maskedHost: string }>} */
  const exposures = []
  for (const variable of urlVariables) {
    const value = String(env[variable] ?? "").trim()
    if (!/^postgres(?:ql)?:\/\//i.test(value)) continue
    const target = classifyDatabaseUrl(value)
    if (target.branch === "production") exposures.push({ variable, endpoint: target.endpoint, maskedHost: target.maskedHost })
  }
  if (redis) {
    for (const variable of REDIS_URL_VARIABLES) {
      const value = String(env[variable] ?? "").trim()
      if (!value) continue
      let host = ""
      try {
        host = new URL(value).hostname
      } catch {
        /* an unparsable URL is not provably local */
      }
      if (!LOCAL_HOST.test(host)) exposures.push({ variable, endpoint: "redis", maskedHost: host ? `${host.slice(0, 4)}****` : "(unparsable)" })
    }
  }

  const confirmed = parseConfirmation(env[ALLOW_PRODUCTION_WRITES_VARIABLE])
  const missing = exposures.filter((e) => !confirmed.has(e.endpoint))
  if (missing.length === 0) return { ok: true, active: exposures.length > 0, confirmed: [...new Set(exposures.map((e) => e.endpoint))] }

  const endpoints = [...new Set(missing.map((e) => e.endpoint))]
  return {
    ok: false,
    exposures: missing,
    reason:
      `${tool} writes, and this machine's environment points it at PRODUCTION: ` +
      `${missing.map((e) => `${e.variable} → ${e.maskedHost}`).join(", ")}. ` +
      "A tool run from a laptop must not act on production by accident. Point it at staging (e.g. `npm run dev:staging`, or DATABASE_URL, " +
      `DIRECT_URL and DATABASE_URL_UNPOOLED set to the staging branch) — or, if production is what you mean, say so: ` +
      `${ALLOW_PRODUCTION_WRITES_VARIABLE}=${endpoints.join(",")} <the same command>.`,
  }
}

/**
 * Call it right BEFORE creating the Prisma client (after the tool has loaded its env files). Exits the process with code 2 when the
 * tool would act on production by accident.
 * @param {string} tool a name for the message (npm script or file)
 * @param {{ env?: Record<string, string | undefined>, root?: string, urlVariables?: string[], redis?: boolean }} [options]
 */
export function assertNotProductionByAccident(tool, { env = process.env, root = repoRoot(), urlVariables, redis } = {}) {
  const verdict = assessProductionByAccident({ tool, env, developerMachine: hasDeveloperEnvFiles(root), urlVariables, redis })
  if (verdict.ok) return
  console.error(`\n✗ [${tool}] REFUSED: ${verdict.reason}\n`)
  process.exit(2)
}
