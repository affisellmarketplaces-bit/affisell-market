import { EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT } from "@/lib/expansion/expansion-auto-pause-notify"
import { EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT } from "@/lib/expansion/compute-country-delivery-rate"

export function followupDeliveryDigestBadge(deliveryRatePct: number): string {
  if (deliveryRatePct > 0 && deliveryRatePct < EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT) {
    return " · 🔴 auto-pause zone"
  }
  if (deliveryRatePct > 0 && deliveryRatePct < EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT) {
    return " · ⚠ low delivery"
  }
  return ""
}

export function shouldShowFollowupLowDeliveryDigestRow(args: {
  followUpCount: number
  launchFollowupDeliveryRatePct: number
}): boolean {
  return (
    args.followUpCount >= 10 &&
    args.launchFollowupDeliveryRatePct > 0 &&
    args.launchFollowupDeliveryRatePct < EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT
  )
}

export function followupDeliveryAlertDigestBadge(args: {
  launchFollowupDeliveryRatePct: number
  launchFollowupPaused: boolean
}): string {
  if (
    args.launchFollowupPaused &&
    args.launchFollowupDeliveryRatePct > 0 &&
    args.launchFollowupDeliveryRatePct < EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT
  ) {
    return " · 🔴 auto-paused"
  }
  if (
    args.launchFollowupDeliveryRatePct > 0 &&
    args.launchFollowupDeliveryRatePct < EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT
  ) {
    return " · ⚠ delivery alert"
  }
  return ""
}

/** Dedicated alert row — min 10 sent with J+2 delivery below 80% (mirrors bounce alert). */
export function shouldShowFollowupDeliveryAlertDigestRow(args: {
  launchFollowupSentThisMonth: number
  launchFollowupDeliveryRatePct: number
}): boolean {
  return (
    args.launchFollowupSentThisMonth >= 10 &&
    args.launchFollowupDeliveryRatePct > 0 &&
    args.launchFollowupDeliveryRatePct < EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT
  )
}
