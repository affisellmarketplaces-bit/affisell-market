export const EXPANSION_BOUNCE_RATE_ALERT_THRESHOLD_PCT = 5
export const EXPANSION_BOUNCE_RATE_MIN_NOTIFIED = 10

export function computeCountryBounceRatePct(args: {
  notifiedCount: number
  retriesPending: number
  suppressed: number
}): number {
  const bounceAffected = args.retriesPending + args.suppressed
  const notifiedBase = args.notifiedCount + args.retriesPending
  if (notifiedBase === 0 || bounceAffected === 0) return 0
  return Math.round((bounceAffected / notifiedBase) * 1000) / 10
}

export function shouldAlertCountryBounceRate(args: {
  notifiedCount: number
  retriesPending: number
  suppressed: number
  thresholdPct?: number
  minNotified?: number
}): boolean {
  const thresholdPct = args.thresholdPct ?? EXPANSION_BOUNCE_RATE_ALERT_THRESHOLD_PCT
  const minNotified = args.minNotified ?? EXPANSION_BOUNCE_RATE_MIN_NOTIFIED
  const notifiedBase = args.notifiedCount + args.retriesPending
  if (notifiedBase < minNotified) return false
  return computeCountryBounceRatePct(args) > thresholdPct
}
