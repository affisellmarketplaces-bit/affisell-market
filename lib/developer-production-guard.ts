import "server-only"

import { existsSync } from "node:fs"
import { join } from "node:path"

import { extractHostFromDatabaseUrl, resolveNeonBranchFromHost } from "@/lib/db-env"

/**
 * Developer machine + PRODUCTION database + a write = refused, unless the endpoint was named explicitly.
 *
 * Why: on a developer machine `.env` / `.env.local` hold the production DATABASE_URL (and DIRECT_URL, which `fulfillmentPrisma`
 * prefers even when `npm run dev:staging` only overrides DATABASE_URL). `npm run dev`, a script importing `@/lib/prisma`, a worker —
 * anything started from a laptop — then writes to production without anyone having said so. Reads stay allowed, so a developer can
 * still look at production data from the local UI; every write is refused with a message that says how to confirm on purpose.
 *
 *     AFFISELL_ALLOW_PRODUCTION_WRITES=ep-misty-sea-al1ne07p  npm run <command>
 *
 * Inert on any real host: "developer machine" means a secret-bearing env file is present in the working directory, which is
 * gitignored and never committed — Vercel, Railway and CI never have one. Mirrors scripts/lib/production-guard.mjs (the same rule for
 * standalone scripts); lib/__tests__/developer-production-guard.test.ts keeps the two in step.
 */

export const ALLOW_PRODUCTION_WRITES_VARIABLE = "AFFISELL_ALLOW_PRODUCTION_WRITES"

/** Mirror of DEVELOPER_ENV_FILES in scripts/build-isolated.mjs (a test fails if they drift). */
export const DEVELOPER_ENV_FILES = [
  ".env",
  ".env.local",
  ".env.development.local",
  ".env.production.local",
  ".env.test.local",
  ".env.pre-local-merge.bak",
] as const

export class DeveloperProductionWriteBlockedError extends Error {
  readonly operation: string
  readonly model: string | null
  readonly endpoint: string

  constructor(operation: string, model: string | null | undefined, endpoint: string, reason: string) {
    super(
      `[dev-guard] Write refused (${operation}${model ? ` on ${model}` : ""}): ${reason}. This machine's environment points the application at the PRODUCTION ` +
        `database (${endpoint}-****). Point it at staging (\`npm run dev:staging\`, with DATABASE_URL, DIRECT_URL and DATABASE_URL_UNPOOLED on the staging ` +
        `branch), or, if production is what you mean, confirm it: ${ALLOW_PRODUCTION_WRITES_VARIABLE}=${endpoint} <the same command>. Reads are not affected.`
    )
    this.name = "DeveloperProductionWriteBlockedError"
    this.operation = operation
    this.model = model ?? null
    this.endpoint = endpoint
  }
}

/** The production endpoint id ("ep-misty-sea-…", pooler suffix removed) a URL names, or null when it is not the production database. */
export function productionEndpointOf(databaseUrl: string | undefined | null): string | null {
  const host = extractHostFromDatabaseUrl(databaseUrl)
  if (!host) return null
  if (resolveNeonBranchFromHost(host.replace(/:\d+$/, "")) !== "production") return null
  const endpoint = host.match(/^(ep-[a-z0-9-]+)/i)?.[1]
  return endpoint ? endpoint.toLowerCase().replace(/-pooler$/, "") : host.toLowerCase().replace(/:\d+$/, "")
}

let developerMachineCache: boolean | undefined

/** True when a secret-bearing env file sits in the working directory. Cached for the default directory (the files do not appear mid-run). */
export function isDeveloperMachine(cwd?: string): boolean {
  if (cwd !== undefined) return DEVELOPER_ENV_FILES.some((name) => existsSync(join(cwd, name)))
  if (developerMachineCache === undefined) developerMachineCache = DEVELOPER_ENV_FILES.some((name) => existsSync(join(process.cwd(), name)))
  return developerMachineCache
}

/** Test seam: forget the cached answer. */
export function resetDeveloperMachineCache(): void {
  developerMachineCache = undefined
}

function confirmedEndpoints(env: Record<string, string | undefined>): Set<string> {
  return new Set(
    String(env[ALLOW_PRODUCTION_WRITES_VARIABLE] ?? "")
      .split(/[\s,]+/)
      .map((token) => token.trim().toLowerCase().replace(/-pooler$/, ""))
      .filter(Boolean)
  )
}

/**
 * Throws DeveloperProductionWriteBlockedError when a WRITE is about to reach the production database from a developer machine without
 * explicit confirmation. A read, a non-production target, or a real host: returns.
 */
export function assertDeveloperProductionWriteAllowed(input: {
  operation: string
  model?: string | null
  write: boolean
  reason?: string
  databaseUrl?: string | null
  env?: Record<string, string | undefined>
  developerMachine?: boolean
}): void {
  if (!input.write) return
  const endpoint = productionEndpointOf(input.databaseUrl)
  if (!endpoint) return
  const developerMachine = input.developerMachine ?? isDeveloperMachine()
  if (!developerMachine) return
  if (confirmedEndpoints(input.env ?? process.env).has(endpoint)) return

  const error = new DeveloperProductionWriteBlockedError(input.operation, input.model, endpoint, input.reason ?? "write")
  console.error("[dev-guard]", { result: "write_blocked", operation: input.operation, model: input.model ?? null, endpoint: `${endpoint}-****` })
  throw error
}
