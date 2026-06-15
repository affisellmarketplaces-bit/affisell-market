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

export function shouldShowLaunchDeliveredDigestRow(args: {
  notifiedCount: number
  launchEmailsDeliveredThisMonth: number
}): boolean {
  return args.notifiedCount >= 10 && args.launchEmailsDeliveredThisMonth > 0
}

export function shouldShowLaunchNotifyPausedDigestRow(args: {
  launchNotifyPaused: boolean
}): boolean {
  return args.launchNotifyPaused
}

export function launchDeliveryAlertDigestBadge(args: {
  launchDeliveryRatePct: number
  launchNotifyPaused: boolean
}): string {
  if (
    args.launchNotifyPaused &&
    args.launchDeliveryRatePct > 0 &&
    args.launchDeliveryRatePct < EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT
  ) {
    return " · 🔴 auto-paused"
  }
  if (
    args.launchDeliveryRatePct > 0 &&
    args.launchDeliveryRatePct < EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT
  ) {
    return " · ⚠ delivery alert"
  }
  return ""
}

/** Dedicated alert row — min 10 notified with launch delivery below 80% (mirrors bounce alert). */
export function shouldShowLaunchDeliveryAlertDigestRow(args: {
  notifiedCount: number
  launchDeliveryRatePct: number
}): boolean {
  return (
    args.notifiedCount >= 10 &&
    args.launchDeliveryRatePct > 0 &&
    args.launchDeliveryRatePct < EXPANSION_LOW_DELIVERY_RATE_THRESHOLD_PCT
  )
}
