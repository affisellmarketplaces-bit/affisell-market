import "server-only"

/** Global kill switch — requires TRY_ON_ENABLED=1 in production. */
export function isTryOnGloballyEnabled(): boolean {
  return process.env.TRY_ON_ENABLED === "1"
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
