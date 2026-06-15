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

export function graduationBounceAlertDigestBadge(args: {
  launchGraduatedBounceRatePct: number
  graduationEmailPaused: boolean
}): string {
  if (args.graduationEmailPaused && args.launchGraduatedBounceRatePct > 0) {
    return " · 🔴 auto-paused"
  }
  if (args.launchGraduatedBounceRatePct > 0) {
    return " · 📉 bounce alert"
  }
  return ""
}

/** Dedicated alert row — min 10 sent with any graduation bounce activity (mirrors J+2 bounce alert). */
export function shouldShowGraduationBounceAlertDigestRow(args: {
  launchGraduatedSentThisMonth: number
  launchGraduatedBouncesThisMonth: number
}): boolean {
  return args.launchGraduatedSentThisMonth >= 10 && args.launchGraduatedBouncesThisMonth > 0
}
