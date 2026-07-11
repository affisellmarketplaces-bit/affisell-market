/** Server — strict env: ENABLE_INSTANTSCAN=1 OR ENABLE_AI_VISION_V2=1 */
export function isInstantScanServerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ENABLE_INSTANTSCAN?.trim() === "1" || env.ENABLE_AI_VISION_V2?.trim() === "1"
}

/**
 * Client flag — NEXT_PUBLIC_ENABLE_INSTANTSCAN or legacy NEXT_PUBLIC_ENABLE_AI_VISION_V2.
 * (Non-public ENABLE_AI_VISION_V2 is only available server-side.)
 */
export function getClientFlag(env: NodeJS.ProcessEnv = process.env): boolean {
  const instant = env.NEXT_PUBLIC_ENABLE_INSTANTSCAN?.trim()
  const vision =
    env.NEXT_PUBLIC_ENABLE_AI_VISION_V2?.trim() ?? env.ENABLE_AI_VISION_V2?.trim()
  return instant === "1" || vision === "1"
}

/** @deprecated use getClientFlag */
export function isInstantScanClientEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return getClientFlag(env)
}

/** Branded UI when InstantScan flag is explicitly on (server or public build-time env). */
export function isInstantScanBranded(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.NEXT_PUBLIC_ENABLE_INSTANTSCAN?.trim() === "1" ||
    env.ENABLE_INSTANTSCAN?.trim() === "1"
  )
}

export function getInstantScanDisplayName(env: NodeJS.ProcessEnv = process.env): string {
  return isInstantScanBranded(env) ? "⚡ InstantScan" : "Guidé"
}

/** Tab label + toasts — requires NEXT_PUBLIC_ENABLE_INSTANTSCAN=1 in prod builds. */
export const INSTANTSCAN_NAME = getInstantScanDisplayName()
