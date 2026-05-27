/** Affiliate listing luxury visibility on `/luxe`. */
export const LUXURY_TIER_NONE = "NONE" as const
export const LUXURY_TIER_LUXE = "LUXE" as const
export const LUXURY_TIER_COLLECTION = "COLLECTION" as const

export type LuxuryTier =
  | typeof LUXURY_TIER_NONE
  | typeof LUXURY_TIER_LUXE
  | typeof LUXURY_TIER_COLLECTION

const VALID = new Set<string>([LUXURY_TIER_NONE, LUXURY_TIER_LUXE, LUXURY_TIER_COLLECTION])

export function parseLuxuryTier(raw: unknown): LuxuryTier | undefined {
  if (raw === undefined || raw === null) return undefined
  const v = typeof raw === "string" ? raw.trim().toUpperCase() : ""
  if (!VALID.has(v)) return LUXURY_TIER_NONE
  return v as LuxuryTier
}

export function isLuxuryTierVisible(tier: string): boolean {
  return tier === LUXURY_TIER_LUXE || tier === LUXURY_TIER_COLLECTION
}
