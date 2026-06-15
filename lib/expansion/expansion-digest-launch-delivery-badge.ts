import { EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT } from "@/lib/expansion/expansion-auto-pause-notify"
import { EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT } from "@/lib/expansion/compute-country-delivery-rate"

export function launchDeliveryDigestBadge(deliveryRatePct: number): string {
  if (deliveryRatePct > 0 && deliveryRatePct < EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT) {
    return " · 🔴 auto-pause zone"
  }
  if (deliveryRatePct > 0 && deliveryRatePct < EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT) {
    return " · ⚠ low delivery"
  }
  return ""
}

export function shouldShowLaunchLowDeliveryDigestRow(args: {
  notifiedCount: number
  launchDeliveryRatePct: number
}): boolean {
  return (
    args.notifiedCount >= 10 &&
    args.launchDeliveryRatePct > 0 &&
    args.launchDeliveryRatePct < EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT
  )
}
