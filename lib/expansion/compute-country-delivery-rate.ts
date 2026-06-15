export const EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT = 80
export const EXPANSION_DELIVERY_RATE_MIN_NOTIFIED = 10

export function computeLaunchDeliveryRatePct(args: {
  deliveredThisMonth: number
  notifiedCount: number
}): number {
  if (args.deliveredThisMonth === 0 || args.notifiedCount === 0) return 0
  return Math.min(100, Math.round((args.deliveredThisMonth / args.notifiedCount) * 1000) / 10)
}

export function shouldAlertLowLaunchDeliveryRate(args: {
  deliveredThisMonth: number
  notifiedCount: number
  thresholdPct?: number
  minNotified?: number
}): boolean {
  const thresholdPct = args.thresholdPct ?? EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT
  const minNotified = args.minNotified ?? EXPANSION_DELIVERY_RATE_MIN_NOTIFIED
  if (args.notifiedCount < minNotified) return false
  if (args.deliveredThisMonth === 0) return true
  return computeLaunchDeliveryRatePct(args) < thresholdPct
}
