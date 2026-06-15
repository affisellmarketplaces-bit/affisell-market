import { computeLaunchDeliveryRatePct } from "@/lib/expansion/compute-country-delivery-rate"
import { isDeliveryPauseReason } from "@/lib/expansion/expansion-complaint-clear-window"

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

export function shouldAutoResumeLaunchFollowupOnDelivery(args: {
  followupDeliveredThisMonth: number
  followupSentCount: number
  thresholdPct?: number
  minSent?: number
}): boolean {
  const thresholdPct = args.thresholdPct ?? EXPANSION_AUTO_RESUME_DELIVERY_THRESHOLD_PCT
  const minSent = args.minSent ?? 10
  if (args.followupSentCount < minSent) return false
  if (args.followupDeliveredThisMonth === 0) return false
  return (
    computeLaunchDeliveryRatePct({
      deliveredThisMonth: args.followupDeliveredThisMonth,
      notifiedCount: args.followupSentCount,
    }) >= thresholdPct
  )
}

/** Cross-signal: resume launch notify paused on delivery when J+2 follow-up delivery recovers ≥80%. */
export function shouldAutoResumeLaunchNotifyOnFollowupDelivery(args: {
  followupDeliveredThisMonth: number
  followupSentCount: number
  pausedReason: string | null | undefined
  thresholdPct?: number
  minSent?: number
}): boolean {
  if (!isDeliveryPauseReason(args.pausedReason)) return false
  return shouldAutoResumeLaunchFollowupOnDelivery({
    followupDeliveredThisMonth: args.followupDeliveredThisMonth,
    followupSentCount: args.followupSentCount,
    thresholdPct: args.thresholdPct,
    minSent: args.minSent,
  })
}

export function shouldAutoResumeGraduationOnDelivery(args: {
  graduatedDeliveredThisMonth: number
  graduatedSentCount: number
  thresholdPct?: number
  minSent?: number
}): boolean {
  const thresholdPct = args.thresholdPct ?? EXPANSION_AUTO_RESUME_DELIVERY_THRESHOLD_PCT
  const minSent = args.minSent ?? 10
  if (args.graduatedSentCount < minSent) return false
  if (args.graduatedDeliveredThisMonth === 0) return false
  return (
    computeLaunchDeliveryRatePct({
      deliveredThisMonth: args.graduatedDeliveredThisMonth,
      notifiedCount: args.graduatedSentCount,
    }) >= thresholdPct
  )
}
