/** Server — strict env: ENABLE_INSTANTSCAN=1 OR ENABLE_AI_VISION_V2=1 */
export function isInstantScanServerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ENABLE_INSTANTSCAN?.trim() === "1" || env.ENABLE_AI_VISION_V2?.trim() === "1"
}

/** Client always attempts API — server returns 501 when disabled. */
export function isInstantScanClientEnabled(): boolean {
  return true
}
