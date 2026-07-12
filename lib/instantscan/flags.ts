import { INSTANTSCAN_NAME, INSTANTSCAN_PRODUCT_NAME } from "@/lib/instantscan/brand"

export { INSTANTSCAN_NAME, INSTANTSCAN_PRODUCT_NAME, getInstantScanDisplayName } from "@/lib/instantscan/brand"

/** Server — ENABLE_INSTANTSCAN=1|true OR ENABLE_AI_VISION_V2=1|true */
export function isInstantScanServerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const instant = env.ENABLE_INSTANTSCAN?.trim().toLowerCase()
  const vision = env.ENABLE_AI_VISION_V2?.trim().toLowerCase()
  return instant === "1" || instant === "true" || vision === "1" || vision === "true"
}

/**
 * Client telemetry hint — public env mirrors (optional).
 * API calls are always attempted; server returns 501 if disabled.
 */
export function getClientFlag(_env: NodeJS.ProcessEnv = process.env): boolean {
  return true
}

/** @deprecated use getClientFlag */
export function isInstantScanClientEnabled(): boolean {
  return true
}
