import { computeLaunchDeliveryRatePct } from "@/lib/expansion/compute-country-delivery-rate"

export const EXPANSION_AUTO_RESUME_DELIVERY_THRESHOLD_PCT = 80

export function shouldAutoResumeLaunchNotify(args: {
  deliveredThisMonth: number
  notifiedCount: number
  thresholdPct?: number
  minNotified?: number
}): boolean {
  const thresholdPct = args.thresholdPct ?? EXPANSION_AUTO_RESUME_DELIVERY_THRESHOLD_PCT
  const minNotified = args.minNotified ?? 10
  if (args.notifiedCount < minNotified) return false
  if (args.deliveredThisMonth === 0) return false
  return computeLaunchDeliveryRatePct(args) >= thresholdPct
}
