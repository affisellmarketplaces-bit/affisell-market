/** Live profit presets — client-safe (no Prisma). */

export type ProfitPresetId = "low" | "medium" | "high"

export type ProfitPreset = {
  adCost: number
  label: string
}

/** Ad-spend presets (platform fee is separate — see SALE_PLATFORMS). */
export const PROFIT_PRESETS: Record<ProfitPresetId, ProfitPreset> = {
  low: { adCost: 5, label: "Organique / TikTok" },
  medium: { adCost: 8, label: "FB Ads standard" },
  high: { adCost: 12, label: "FB Ads compétitif" },
}

export const DEFAULT_PROFIT_PRESET: ProfitPresetId = "medium"

export type SalePlatformId = "affisell" | "shopify" | "tiktok"

export type SalePlatform = {
  feeRate: number
  /** Short fee line label (FR UI — calculator is FR-first today). */
  feeLabelFr: string
  feeLabelEn: string
  optionLabelFr: string
  optionLabelEn: string
  tooltipFr: string
  tooltipEn: string
}

/**
 * Default = Affisell ecosystem. Shopify / TikTok only for export what-if.
 * Affisell 2% = commission plateforme (pas de frais cachés).
 * Shopify 2.5% ≈ 2% Shopify + 0.5% Stripe.
 * TikTok Shop ≈ 5%.
 */
export const SALE_PLATFORMS: Record<SalePlatformId, SalePlatform> = {
  affisell: {
    feeRate: 0.02,
    feeLabelFr: "Frais Affisell",
    feeLabelEn: "Affisell fee",
    optionLabelFr: "Affisell.com (2% — recommandé)",
    optionLabelEn: "Affisell.com (2% — recommended)",
    tooltipFr: "Commission Affisell incluse — pas de frais cachés",
    tooltipEn: "Affisell commission included — no hidden fees",
  },
  shopify: {
    feeRate: 0.025,
    feeLabelFr: "Frais Shopify",
    feeLabelEn: "Shopify fee",
    optionLabelFr: "Shopify (2% + 0.5% Stripe)",
    optionLabelEn: "Shopify (2% + 0.5% Stripe)",
    tooltipFr: "Estimation export Shopify + Stripe — hors écosystème Affisell",
    tooltipEn: "Estimated Shopify + Stripe export fees — outside Affisell",
  },
  tiktok: {
    feeRate: 0.05,
    feeLabelFr: "Frais TikTok Shop",
    feeLabelEn: "TikTok Shop fee",
    optionLabelFr: "TikTok Shop (5%)",
    optionLabelEn: "TikTok Shop (5%)",
    tooltipFr: "Estimation commission TikTok Shop",
    tooltipEn: "Estimated TikTok Shop commission",
  },
}

export const DEFAULT_SALE_PLATFORM: SalePlatformId = "affisell"

export type NetProfitBreakdown = {
  salePrice: number
  cost: number
  /** Platform take (Affisell by default). */
  platformFee: number
  /** @deprecated Use platformFee — kept for older call sites. */
  shopifyFee: number
  shippingCost: number
  adCost: number
  profit: number
  marginPercent: number
  roasBreak: number
  tone: "green" | "yellow" | "red"
  salePlatform: SalePlatformId
  feeRate: number
}

export function resolveSalePlatformFeeRate(
  platform: SalePlatformId = DEFAULT_SALE_PLATFORM,
  overrideRate?: number
): number {
  if (typeof overrideRate === "number" && Number.isFinite(overrideRate)) {
    return Math.max(0, overrideRate)
  }
  return SALE_PLATFORMS[platform]?.feeRate ?? SALE_PLATFORMS.affisell.feeRate
}

export function computeNetProfit(args: {
  salePrice: number
  cost: number
  shippingCost?: number
  adCost?: number
  /** Preferred: Affisell / Shopify / TikTok what-if. Default Affisell. */
  salePlatform?: SalePlatformId
  /** Explicit rate override (0–1). */
  platformFeeRate?: number
  /** @deprecated Use platformFeeRate or salePlatform. */
  shopifyFeeRate?: number
}): NetProfitBreakdown {
  const salePrice = Math.max(0, Number(args.salePrice) || 0)
  const cost = Math.max(0, Number(args.cost) || 0)
  const shippingCost = Math.max(0, Number(args.shippingCost) || 0)
  const adCost = Math.max(0, args.adCost ?? PROFIT_PRESETS.medium.adCost)
  const salePlatform = args.salePlatform ?? DEFAULT_SALE_PLATFORM
  const feeRate = resolveSalePlatformFeeRate(
    salePlatform,
    args.platformFeeRate ?? args.shopifyFeeRate
  )
  const platformFee = Math.round(salePrice * feeRate * 100) / 100
  const profit =
    Math.round((salePrice - cost - platformFee - shippingCost - adCost) * 100) / 100
  const marginPercent = salePrice > 0 ? Math.round((profit / salePrice) * 1000) / 10 : 0
  const denom = cost + adCost
  const roasBreak = denom > 0 ? Math.round((salePrice / denom) * 100) / 100 : 0
  const tone: NetProfitBreakdown["tone"] =
    profit > 10 ? "green" : profit >= 5 ? "yellow" : "red"

  return {
    salePrice,
    cost,
    platformFee,
    shopifyFee: platformFee,
    shippingCost,
    adCost,
    profit,
    marginPercent,
    roasBreak,
    tone,
    salePlatform,
    feeRate,
  }
}

export function formatProfitEuro(n: number): string {
  const sign = n > 0 ? "+" : ""
  return `${sign}${n.toFixed(2).replace(".", ",")}€`
}
