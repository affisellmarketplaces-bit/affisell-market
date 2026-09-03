import type { EnvBag } from "@/lib/env-bag"

export { INSTANTSCAN_NAME, INSTANTSCAN_PRODUCT_NAME, getInstantScanDisplayName } from "@/lib/instantscan/brand"

/**
 * InstantScan retired from supplier wizard (Express + Pro only).
 * API stays behind explicit ENABLE_INSTANTSCAN=1|true for diagnostics.
 */
export function isInstantScanServerEnabled(env: EnvBag = process.env): boolean {
  const instant = env.ENABLE_INSTANTSCAN?.trim().toLowerCase()
  return instant === "1" || instant === "true"
}

/**
 * Client telemetry hint — public env mirrors (optional).
 * API calls are always attempted; server returns 501 if disabled.
 */
export function getClientFlag(_env: EnvBag = process.env): boolean {
  return false
}

/** @deprecated use getClientFlag */
export function isInstantScanClientEnabled(): boolean {
  return false
}
