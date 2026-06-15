import { EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT } from "@/lib/expansion/expansion-auto-pause-notify"
import { EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT } from "@/lib/expansion/compute-country-delivery-rate"

export function graduationDeliveryDigestBadge(deliveryRatePct: number): string {
  if (deliveryRatePct > 0 && deliveryRatePct < EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT) {
    return " · 🔴 auto-pause zone"
  }
  if (deliveryRatePct > 0 && deliveryRatePct < EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT) {
    return " · ⚠ low delivery"
  }
  return ""
}

export function shouldShowGraduationLowDeliveryDigestRow(args: {
  launchGraduatedSentThisMonth: number
  launchGraduatedDeliveryRatePct: number
}): boolean {
  return (
    args.launchGraduatedSentThisMonth >= 10 &&
    args.launchGraduatedDeliveryRatePct > 0 &&
    args.launchGraduatedDeliveryRatePct < EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT
  )
}

export function graduationDeliveryAlertDigestBadge(args: {
  launchGraduatedDeliveryRatePct: number
  graduationEmailPaused: boolean
}): string {
  if (
    args.graduationEmailPaused &&
    args.launchGraduatedDeliveryRatePct > 0 &&
    args.launchGraduatedDeliveryRatePct < EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT
  ) {
    return " · 🔴 auto-paused"
  }
  if (
    args.launchGraduatedDeliveryRatePct > 0 &&
    args.launchGraduatedDeliveryRatePct < EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT
  ) {
    return " · ⚠ delivery alert"
  }
  return ""
}

/** Dedicated alert row — min 10 sent with graduation delivery below 80% (mirrors bounce alert). */
export function shouldShowGraduationDeliveryAlertDigestRow(args: {
  launchGraduatedSentThisMonth: number
  launchGraduatedDeliveryRatePct: number
}): boolean {
  return (
    args.launchGraduatedSentThisMonth >= 10 &&
    args.launchGraduatedDeliveryRatePct > 0 &&
    args.launchGraduatedDeliveryRatePct < EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT
  )
}
