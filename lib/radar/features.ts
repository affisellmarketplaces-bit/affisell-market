import { resolveRadarBetaUserIds, resolveRadarEnabled } from "@/lib/radar/env"

/** Entitlements for Affisell Radar — no DB imports (safe when flag is off). */
export function resolveRadarFeatures(userId: string, isPro: boolean): string[] {
  if (resolveRadarEnabled() !== "true") return []

  const betaIds = resolveRadarBetaUserIds()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)

  if (isPro || betaIds.includes(userId)) return ["market_intelli"]
  return []
}
