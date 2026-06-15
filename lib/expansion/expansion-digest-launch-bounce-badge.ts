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
