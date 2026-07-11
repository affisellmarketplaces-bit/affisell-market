import { INSTANTSCAN_NAME, INSTANTSCAN_PRODUCT_NAME } from "@/lib/instantscan/brand"

export { INSTANTSCAN_NAME, INSTANTSCAN_PRODUCT_NAME, getInstantScanDisplayName } from "@/lib/instantscan/brand"

/** Server — strict env: ENABLE_INSTANTSCAN=1 OR ENABLE_AI_VISION_V2=1 */
export function isInstantScanServerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ENABLE_INSTANTSCAN?.trim() === "1" || env.ENABLE_AI_VISION_V2?.trim() === "1"
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
