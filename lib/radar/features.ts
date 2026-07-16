import { RADAR_BETA_USER_IDS, RADAR_ENABLED } from "@/lib/radar/env"

/** Entitlements for Affisell Radar — no DB imports (safe when flag is off). */
export function resolveRadarFeatures(userId: string, isPro: boolean): string[] {
  if (RADAR_ENABLED !== "true") return []

  if (isPro || RADAR_BETA_USER_IDS.includes(userId)) {
    return ["radar", "market_intelli"]
  }
  return []
}

export function hasRadarAccess(features: string[] | undefined, userId?: string): boolean {
  if (Array.isArray(features) && (features.includes("radar") || features.includes("market_intelli"))) {
    return true
  }
  if (userId && RADAR_BETA_USER_IDS.includes(userId)) return true
  return false
}
