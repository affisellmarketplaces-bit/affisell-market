import {
  extractHostFromDatabaseUrl,
  maskDbHost,
  resolveNeonBranchFromHost,
} from "@/lib/db-env"
import { loadEnv, resolveDatabaseUrlOptional } from "@/lib/env"

export type DonaRuntimeEnv = "prod" | "staging"

export type DonaEnvInfo = {
  env: DonaRuntimeEnv
  branch: string
  dbHost: string
  isProd: boolean
}

const PROD_MARKER = "misty-sea"
const STAGING_MARKER = "shy-wind"

function neonEndpointSlug(host: string): string {
  const match = host.match(/^(ep-[a-z0-9-]+)/i)
  return match?.[1] ?? host
}

function resolveDonaEnv(databaseUrl: string, stagingUrl: string, host: string): DonaRuntimeEnv {
  const urlLower = databaseUrl.toLowerCase()
  const hostLower = host.toLowerCase()

  if (urlLower.includes(PROD_MARKER) || hostLower.includes(PROD_MARKER)) {
    return "prod"
  }
  if (
    urlLower.includes(STAGING_MARKER) ||
    hostLower.includes(STAGING_MARKER) ||
    (!databaseUrl && stagingUrl)
  ) {
    return "staging"
  }

  const branch = resolveNeonBranchFromHost(host)
  if (branch === "production") return "prod"
  return "staging"
}

/** Dona terminal + copilot — which Neon branch the Capitaine is wired to. */
export function getEnvInfo(): DonaEnvInfo {
  loadEnv()
  const databaseUrl = process.env.DATABASE_URL?.trim() || ""
  const stagingUrl = process.env.DATABASE_URL_STAGING?.trim() || ""
  const resolvedUrl = databaseUrl || stagingUrl || resolveDatabaseUrlOptional() || ""
  const host = extractHostFromDatabaseUrl(resolvedUrl)
  const env = resolveDonaEnv(databaseUrl, stagingUrl, host)
  const branch = env === "prod" ? "production" : "staging"

  return {
    env,
    branch,
    dbHost: host ? neonEndpointSlug(host) : maskDbHost(host),
    isProd: env === "prod",
  }
}

export { PROD_MARKER, STAGING_MARKER }
