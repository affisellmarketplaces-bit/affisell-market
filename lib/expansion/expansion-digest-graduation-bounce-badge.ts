import {
  EXPANSION_BOUNCE_RATE_ALERT_THRESHOLD_PCT,
  shouldAlertGraduatedBounceRate,
} from "@/lib/expansion/compute-country-bounce-rate"

export function graduationBounceDigestBadge(bounceRatePct: number): string {
  if (bounceRatePct > EXPANSION_BOUNCE_RATE_ALERT_THRESHOLD_PCT) {
    return " · 📉 bounce alert"
  }
  return ""
}

export function shouldShowGraduationHighBounceDigestRow(args: {
  launchGraduatedSentThisMonth: number
  launchGraduatedBouncesThisMonth: number
}): boolean {
  return shouldAlertGraduatedBounceRate({
    bouncesThisMonth: args.launchGraduatedBouncesThisMonth,
    sentCount: args.launchGraduatedSentThisMonth,
  })
}
