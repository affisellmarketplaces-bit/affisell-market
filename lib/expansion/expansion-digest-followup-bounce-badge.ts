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

export function followupBounceAlertDigestBadge(args: {
  launchFollowupBounceRatePct: number
  launchFollowupPaused: boolean
}): string {
  if (args.launchFollowupPaused && args.launchFollowupBounceRatePct > 0) {
    return " · 🔴 auto-paused"
  }
  if (args.launchFollowupBounceRatePct > 0) {
    return " · 📉 bounce alert"
  }
  return ""
}

/** Dedicated alert row — min 10 sent with any J+2 bounce activity (mirrors launch bounce alert). */
export function shouldShowFollowupBounceAlertDigestRow(args: {
  launchFollowupSentThisMonth: number
  launchFollowupBouncesThisMonth: number
}): boolean {
  return args.launchFollowupSentThisMonth >= 10 && args.launchFollowupBouncesThisMonth > 0
}
