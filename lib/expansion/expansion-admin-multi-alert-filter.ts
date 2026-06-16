export const EXPANSION_ADMIN_MULTI_ALERT_QUERY_KEY = "multiAlert"
export const EXPANSION_ADMIN_MULTI_ALERT_FILTER_ON_VALUE = "1"
export const EXPANSION_ADMIN_MULTI_ALERT_FILTER_OFF_VALUE = "0"
export const EXPANSION_ADMIN_EXPANSION_CONSOLE_PATH = "/admin/expansion"

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
  next.set(
    EXPANSION_ADMIN_MULTI_ALERT_QUERY_KEY,
    enabled
      ? EXPANSION_ADMIN_MULTI_ALERT_FILTER_ON_VALUE
      : EXPANSION_ADMIN_MULTI_ALERT_FILTER_OFF_VALUE
  )
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

export function buildExpansionAdminMultiAlertConsoleUrl(adminUrl: string): string {
  const origin = adminUrl.replace(/\/$/, "")
  const path = buildExpansionAdminPathWithMultiAlertFilter(
    EXPANSION_ADMIN_EXPANSION_CONSOLE_PATH,
    new URLSearchParams(),
    true
  )
  return `${origin}${path}`
}

export function buildExpansionAdminClearMultiAlertFilterUrl(adminUrl: string): string {
  const origin = adminUrl.replace(/\/$/, "")
  return `${origin}${EXPANSION_ADMIN_EXPANSION_CONSOLE_PATH}?${EXPANSION_ADMIN_MULTI_ALERT_QUERY_KEY}=${EXPANSION_ADMIN_MULTI_ALERT_FILTER_OFF_VALUE}`
}
