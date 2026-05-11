export const BUYER_REWARD_KINDS = ["NONE", "CASHBACK", "BONUS"] as const
export type BuyerRewardKind = (typeof BUYER_REWARD_KINDS)[number]

export function normalizeBuyerRewardKind(raw: unknown): BuyerRewardKind {
  const s = typeof raw === "string" ? raw.trim().toUpperCase() : ""
  if (s === "CASHBACK" || s === "BONUS") return s
  return "NONE"
}

export function clampBuyerRewardPercent(pct: unknown): number {
  const n = typeof pct === "number" ? pct : Number(pct)
  if (!Number.isFinite(n)) return 0
  return Math.min(50, Math.max(0, Math.round(n)))
}

/** Max % of selling price that can be promised without exceeding affiliate margin (floored). */
export function maxAffordableBuyerRewardPercent(sellingPriceCents: number, basePriceCents: number): number {
  const margin = Math.max(0, Math.round(sellingPriceCents) - Math.round(basePriceCents))
  const sell = Math.round(sellingPriceCents)
  if (margin <= 0 || sell <= 0) return 0
  return Math.min(50, Math.floor((margin * 100) / sell))
}

export function normalizeBuyerRewardForSave(args: {
  kind: BuyerRewardKind
  percent: number
  sellingPriceCents: number
  basePriceCents: number
}): { buyerRewardKind: BuyerRewardKind; buyerRewardPercent: number } {
  const maxPct = maxAffordableBuyerRewardPercent(args.sellingPriceCents, args.basePriceCents)
  const pct = clampBuyerRewardPercent(args.percent)
  if (args.kind === "NONE" || pct <= 0) {
    return { buyerRewardKind: "NONE", buyerRewardPercent: 0 }
  }
  const capped = Math.min(pct, maxPct)
  if (capped <= 0) {
    return { buyerRewardKind: "NONE", buyerRewardPercent: 0 }
  }
  return { buyerRewardKind: args.kind, buyerRewardPercent: capped }
}

export function buyerRewardBadgeText(kind: BuyerRewardKind, pct: number): string | null {
  if (kind === "NONE" || pct <= 0) return null
  if (kind === "CASHBACK") return `${pct}% cashback`
  return `${pct}% store bonus`
}
