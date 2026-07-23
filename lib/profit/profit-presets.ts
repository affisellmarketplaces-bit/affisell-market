/** Live profit presets — client-safe (no Prisma). */

export type ProfitPresetId = "low" | "medium" | "high"

export type ProfitPreset = {
  adCost: number
  shopifyFee: number
  label: string
}

export const PROFIT_PRESETS: Record<ProfitPresetId, ProfitPreset> = {
  low: { adCost: 5, shopifyFee: 0.02, label: "Organique / TikTok" },
  medium: { adCost: 8, shopifyFee: 0.02, label: "FB Ads standard" },
  high: { adCost: 12, shopifyFee: 0.02, label: "FB Ads compétitif" },
}

export const DEFAULT_PROFIT_PRESET: ProfitPresetId = "medium"

export type NetProfitBreakdown = {
  salePrice: number
  cost: number
  shopifyFee: number
  shippingCost: number
  adCost: number
  profit: number
  marginPercent: number
  roasBreak: number
  tone: "green" | "yellow" | "red"
}

export function computeNetProfit(args: {
  salePrice: number
  cost: number
  shippingCost?: number
  adCost?: number
  shopifyFeeRate?: number
}): NetProfitBreakdown {
  const salePrice = Math.max(0, Number(args.salePrice) || 0)
  const cost = Math.max(0, Number(args.cost) || 0)
  const shippingCost = Math.max(0, Number(args.shippingCost) || 0)
  const adCost = Math.max(0, args.adCost ?? PROFIT_PRESETS.medium.adCost)
  const feeRate = args.shopifyFeeRate ?? PROFIT_PRESETS.medium.shopifyFee
  const shopifyFee = Math.round(salePrice * feeRate * 100) / 100
  const profit = Math.round((salePrice - cost - shopifyFee - shippingCost - adCost) * 100) / 100
  const marginPercent = salePrice > 0 ? Math.round((profit / salePrice) * 1000) / 10 : 0
  const denom = cost + adCost
  const roasBreak = denom > 0 ? Math.round((salePrice / denom) * 100) / 100 : 0
  const tone: NetProfitBreakdown["tone"] =
    profit > 10 ? "green" : profit >= 5 ? "yellow" : "red"

  return {
    salePrice,
    cost,
    shopifyFee,
    shippingCost,
    adCost,
    profit,
    marginPercent,
    roasBreak,
    tone,
  }
}

export function formatProfitEuro(n: number): string {
  const sign = n > 0 ? "+" : ""
  return `${sign}${n.toFixed(2).replace(".", ",")}€`
}
