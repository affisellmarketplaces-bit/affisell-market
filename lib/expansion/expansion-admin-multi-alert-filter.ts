export const EXPANSION_ADMIN_MULTI_ALERT_QUERY_KEY = "multiAlert"

export function parseExpansionAdminMultiAlertFilter(
  value: string | null | undefined
): boolean {
  return value === "1" || value === "true"
}

export function readExpansionAdminMultiAlertFilterFromSearchParams(
  searchParams: Pick<URLSearchParams, "get">
): boolean {
  return parseExpansionAdminMultiAlertFilter(
    searchParams.get(EXPANSION_ADMIN_MULTI_ALERT_QUERY_KEY)
  )
}

export function writeExpansionAdminMultiAlertFilterToSearchParams(
  searchParams: URLSearchParams,
  enabled: boolean
): URLSearchParams {
  const next = new URLSearchParams(searchParams.toString())
  if (enabled) next.set(EXPANSION_ADMIN_MULTI_ALERT_QUERY_KEY, "1")
  else next.delete(EXPANSION_ADMIN_MULTI_ALERT_QUERY_KEY)
  return next
}

export function buildExpansionAdminPathWithMultiAlertFilter(
  pathname: string,
  searchParams: URLSearchParams,
  enabled: boolean
): string {
  const next = writeExpansionAdminMultiAlertFilterToSearchParams(searchParams, enabled)
  const qs = next.toString()
  return qs ? `${pathname}?${qs}` : pathname
}
