import {
  SPONSOR_MAX_RATE_BPS,
  SPONSOR_MIN_RATE_BPS,
  SPONSOR_PLACEMENT_FEE_MULTIPLIER,
  type SponsorDurationDays,
  type SponsorPlacement,
} from "@/lib/sponsor/sponsor-constants"

export type SponsorQuoteInput = {
  htCents: number
  sponsorRateBps: number
  durationDays: SponsorDurationDays
  placement: SponsorPlacement
}

export type SponsorQuoteResult = {
  htCents: number
  sponsorRateBps: number
  ratePercent: number
  durationDays: SponsorDurationDays
  placement: SponsorPlacement
  feeCents: number
  boostScore: number
  weeks: number
}

export function clampSponsorRateBps(bps: number): number {
  return Math.min(SPONSOR_MAX_RATE_BPS, Math.max(SPONSOR_MIN_RATE_BPS, Math.round(bps)))
}

/** Fee = HT × rate% × placement multiplier × (duration / 7 days). */
export function quoteSponsorCampaign(input: SponsorQuoteInput): SponsorQuoteResult {
  const sponsorRateBps = clampSponsorRateBps(input.sponsorRateBps)
  const weeks = input.durationDays / 7
  const placementMul = SPONSOR_PLACEMENT_FEE_MULTIPLIER[input.placement]
  const feeCents = Math.max(
    100,
    Math.round((input.htCents * sponsorRateBps * placementMul * weeks) / 10_000)
  )
  const boostScore = Math.round(feeCents * placementMul)

  return {
    htCents: input.htCents,
    sponsorRateBps,
    ratePercent: sponsorRateBps / 100,
    durationDays: input.durationDays,
    placement: input.placement,
    feeCents,
    boostScore,
    weeks,
  }
}
