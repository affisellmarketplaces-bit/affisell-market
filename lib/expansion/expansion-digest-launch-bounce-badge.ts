import {
  EXPANSION_BOUNCE_RATE_ALERT_THRESHOLD_PCT,
  shouldAlertCountryBounceRate,
} from "@/lib/expansion/compute-country-bounce-rate"

export function launchBounceDigestBadge(bounceRatePct: number): string {
  if (bounceRatePct > EXPANSION_BOUNCE_RATE_ALERT_THRESHOLD_PCT) {
    return " · 📉 bounce alert"
  }
  return ""
}

export function shouldShowLaunchHighBounceDigestRow(args: {
  notifiedCount: number
  retriesPending: number
  suppressed: number
}): boolean {
  return shouldAlertCountryBounceRate(args)
}

export function launchBounceAlertDigestBadge(args: {
  launchBounceRatePct: number
  launchNotifyPaused: boolean
}): string {
  if (args.launchNotifyPaused && args.launchBounceRatePct > 0) {
    return " · 🔴 auto-paused"
  }
  if (args.launchBounceRatePct > 0) {
    return " · 📉 bounce alert"
  }
  return ""
}

/** Dedicated alert row — min 10 notified with any launch bounce activity (mirrors complaint alert). */
export function shouldShowLaunchBounceAlertDigestRow(args: {
  notifiedCount: number
  retriesPending: number
  suppressed: number
}): boolean {
  return args.notifiedCount >= 10 && args.retriesPending + args.suppressed > 0
}
