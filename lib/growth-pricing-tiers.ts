/**
 * Shared source of truth for the /pricing "Growth" tiers and the /signup?plan=… links that point
 * at them (components/pricing/affisell-growth-pricing.tsx). Kept here, not duplicated, so the
 * price shown on the pricing page and the one echoed back during signup can't drift apart.
 */
export const GROWTH_PRICING_TIER_IDS = ["lanceur", "dominator", "empire"] as const
export type GrowthPricingTierId = (typeof GROWTH_PRICING_TIER_IDS)[number]

export type GrowthPricingTier = {
  id: GrowthPricingTierId
  name: string
  monthly: number
  annual: number
  role: "SUPPLIER" | "AFFILIATE"
}

export const GROWTH_PRICING_TIERS: Record<GrowthPricingTierId, GrowthPricingTier> = {
  lanceur: { id: "lanceur", name: "Lanceur", monthly: 29, annual: 290, role: "AFFILIATE" },
  dominator: { id: "dominator", name: "Dominator", monthly: 79, annual: 790, role: "SUPPLIER" },
  empire: { id: "empire", name: "Empire", monthly: 149, annual: 990, role: "SUPPLIER" },
}

export function isGrowthPricingTierId(value: string | null | undefined): value is GrowthPricingTierId {
  return typeof value === "string" && (GROWTH_PRICING_TIER_IDS as readonly string[]).includes(value)
}
