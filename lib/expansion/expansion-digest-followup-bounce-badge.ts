import {
  EXPANSION_BOUNCE_RATE_ALERT_THRESHOLD_PCT,
  shouldAlertGraduatedBounceRate,
} from "@/lib/expansion/compute-country-bounce-rate"

export function followupBounceDigestBadge(bounceRatePct: number): string {
  if (bounceRatePct > EXPANSION_BOUNCE_RATE_ALERT_THRESHOLD_PCT) {
    return " · 📉 bounce alert"
  }
  return ""
}

export function shouldShowFollowupHighBounceDigestRow(args: {
  launchFollowupSentThisMonth: number
  launchFollowupBouncesThisMonth: number
}): boolean {
  return shouldAlertGraduatedBounceRate({
    bouncesThisMonth: args.launchFollowupBouncesThisMonth,
    sentCount: args.launchFollowupSentThisMonth,
  })
}
