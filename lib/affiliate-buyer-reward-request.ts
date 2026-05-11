import type { BuyerRewardKind } from "@/lib/affiliate-buyer-reward"
import {
  clampBuyerRewardPercent,
  maxAffordableBuyerRewardPercent,
  normalizeBuyerRewardForSave,
  normalizeBuyerRewardKind,
} from "@/lib/affiliate-buyer-reward"

export type BuyerRewardResolution =
  | { buyerRewardKind: BuyerRewardKind; buyerRewardPercent: number }
  | { error: string }

/**
 * Applies buyer reward rules for create/update.
 * When the client omits reward keys, existing values are re-clamped against the next selling price.
 * When the client sends reward keys, values above affordable margin yield an error (strict).
 */
export function resolveBuyerRewardForListing(args: {
  body: Record<string, unknown>
  basePriceCents: number
  nextSellingCents: number
  existingKind?: string | null
  existingPercent?: number | null
}): BuyerRewardResolution {
  const base = Math.round(args.basePriceCents)
  const sell = Math.round(args.nextSellingCents)
  const maxPct = maxAffordableBuyerRewardPercent(sell, base)

  const hasRewardPatch =
    Object.prototype.hasOwnProperty.call(args.body, "buyerRewardKind") ||
    Object.prototype.hasOwnProperty.call(args.body, "buyerRewardPercent")

  const kindFromBody = normalizeBuyerRewardKind(args.body.buyerRewardKind)
  const pctFromBody = clampBuyerRewardPercent(args.body.buyerRewardPercent)

  let kind: BuyerRewardKind
  let pct: number
  if (hasRewardPatch) {
    kind = Object.prototype.hasOwnProperty.call(args.body, "buyerRewardKind")
      ? kindFromBody
      : normalizeBuyerRewardKind(args.existingKind)
    pct = Object.prototype.hasOwnProperty.call(args.body, "buyerRewardPercent")
      ? pctFromBody
      : clampBuyerRewardPercent(args.existingPercent)
  } else {
    kind = normalizeBuyerRewardKind(args.existingKind)
    pct = clampBuyerRewardPercent(args.existingPercent)
  }

  if (kind === "NONE" || pct <= 0) {
    return { buyerRewardKind: "NONE", buyerRewardPercent: 0 }
  }

  if (maxPct <= 0) {
    if (hasRewardPatch) {
      return {
        error:
          "Buyer rewards need margin above supplier cost: raise your selling price first, or turn off the reward.",
      }
    }
    return { buyerRewardKind: "NONE", buyerRewardPercent: 0 }
  }

  if (hasRewardPatch && pct > maxPct) {
    return {
      error: `Buyer reward cannot exceed ${maxPct}% at this selling price (funded from your margin). Lower the reward or raise your price.`,
    }
  }

  return normalizeBuyerRewardForSave({
    kind,
    percent: pct,
    sellingPriceCents: sell,
    basePriceCents: base,
  })
}
