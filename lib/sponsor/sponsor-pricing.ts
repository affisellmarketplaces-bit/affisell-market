import {
  SPONSOR_MAX_RATE_BPS,
  SPONSOR_MIN_RATE_BPS,
  SPONSOR_PLACEMENT_FEE_MULTIPLIER,
  type SponsorDurationDays,
  type SponsorPlacement,
} from "@/lib/sponsor/sponsor-constants"

export const SPONSOR_BILLING_MODES = ["SUCCESS_FEE", "UPFRONT"] as const
export type SponsorBillingMode = (typeof SPONSOR_BILLING_MODES)[number]

export type SponsorQuoteInput = {
  htCents: number
  sponsorRateBps: number
  durationDays: SponsorDurationDays
  placement: SponsorPlacement
  billingMode?: SponsorBillingMode
}

export type SponsorQuoteResult = {
  htCents: number
  sponsorRateBps: number
  ratePercent: number
  durationDays: SponsorDurationDays
  placement: SponsorPlacement
  billingMode: SponsorBillingMode
  /** UPFRONT prepaid total, or SUCCESS_FEE per-sale fee. */
  feeCents: number
  /** Alias clarity for SUCCESS_FEE UI. */
  feePerSaleCents: number
  boostScore: number
  weeks: number
}

export function clampSponsorRateBps(bps: number): number {
  return Math.min(SPONSOR_MAX_RATE_BPS, Math.max(SPONSOR_MIN_RATE_BPS, Math.round(bps)))
}

export function isSponsorBillingMode(value: unknown): value is SponsorBillingMode {
  return value === "SUCCESS_FEE" || value === "UPFRONT"
}

/**
 * SUCCESS_FEE: pay `HT × rate × placement` only when a sale concludes (no weeks multiplier).
 * UPFRONT: legacy prepaid `HT × rate × placement × weeks` (min 100¢).
 */
export function quoteSponsorCampaign(input: SponsorQuoteInput): SponsorQuoteResult {
  const sponsorRateBps = clampSponsorRateBps(input.sponsorRateBps)
  const weeks = input.durationDays / 7
  const placementMul = SPONSOR_PLACEMENT_FEE_MULTIPLIER[input.placement]
  const billingMode: SponsorBillingMode = input.billingMode ?? "SUCCESS_FEE"

  const perSaleCents = Math.max(
    1,
    Math.round((input.htCents * sponsorRateBps * placementMul) / 10_000)
  )

  const feeCents =
    billingMode === "UPFRONT"
      ? Math.max(100, Math.round((input.htCents * sponsorRateBps * placementMul * weeks) / 10_000))
      : perSaleCents

  /** Ranking power: success-fee campaigns score on rate intensity × window, not prepaid cash. */
  const boostScore =
    billingMode === "SUCCESS_FEE"
      ? Math.round(perSaleCents * placementMul * Math.max(1, weeks))
      : Math.round(feeCents * placementMul)

  return {
    htCents: input.htCents,
    sponsorRateBps,
    ratePercent: sponsorRateBps / 100,
    durationDays: input.durationDays,
    placement: input.placement,
    billingMode,
    feeCents,
    feePerSaleCents: perSaleCents,
    boostScore,
    weeks,
  }
}

/** Pure: fee for one concluded sale given live HT (refunds handled separately). */
export function successFeeCentsForSale(args: {
  htCents: number
  sponsorRateBps: number
  placement: SponsorPlacement
}): number {
  const bps = clampSponsorRateBps(args.sponsorRateBps)
  const mul = SPONSOR_PLACEMENT_FEE_MULTIPLIER[args.placement]
  return Math.max(1, Math.round((Math.max(0, args.htCents) * bps * mul) / 10_000))
}
