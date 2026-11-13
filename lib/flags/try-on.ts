import "server-only"

/** Global kill switch — requires TRY_ON_ENABLED=1 in production. */
export function isTryOnGloballyEnabled(): boolean {
  return process.env.TRY_ON_ENABLED === "1"
}

/**
 * True on the deployment real customers use. `VERCEL_ENV` tells production from preview (a preview build also runs
 * with NODE_ENV=production); outside Vercel, NODE_ENV decides.
 */
function isProductionDeployment(): boolean {
  const vercelEnv = process.env.VERCEL_ENV?.trim()
  if (vercelEnv) return vercelEnv === "production"
  return process.env.NODE_ENV === "production"
}

/**
 * Query param override for preview / QA (`?tryon=1`).
 *
 * It is a QUERY STRING — anyone can add it — so in production it is ignored: the global kill switch must really be a
 * kill switch. Preview deployments and local development keep it.
 */
export function isTryOnQueryOverride(searchParams: URLSearchParams | { get: (k: string) => string | null }): boolean {
  if (isProductionDeployment()) return false
  const v = searchParams.get("tryon")?.trim().toLowerCase()
  return v === "true" || v === "1"
}

export function resolveTryOnFeatureEnabled(
  searchParams?: URLSearchParams | { get: (k: string) => string | null } | null
): boolean {
  if (!isTryOnGloballyEnabled()) {
    if (searchParams && isTryOnQueryOverride(searchParams)) return true
    return false
  }
  return true
}
