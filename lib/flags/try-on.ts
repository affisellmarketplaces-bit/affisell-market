import "server-only"

/** Global kill switch — default OFF in production. */
export function isTryOnGloballyEnabled(): boolean {
  const env = process.env.TRY_ON_ENABLED?.trim()
  if (env === "1" || env === "true") return true
  if (env === "0" || env === "false") return false
  return process.env.NODE_ENV !== "production"
}

/** Query param override for preview / QA. */
export function isTryOnQueryOverride(searchParams: URLSearchParams | { get: (k: string) => string | null }): boolean {
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
