import { EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT } from "@/lib/expansion/expansion-auto-pause-notify"
import {
  expansionComplaintsExportPath,
  expansionDeliveredExportPath,
  expansionEmailExportsBundlePath,
} from "@/lib/admin/expansion-email-export-kinds"

export function followupPausedDigestBadge(args: {
  launchFollowupComplaintsThisMonth: number
  launchFollowupDeliveryRatePct: number
}): string {
  if (args.launchFollowupComplaintsThisMonth > 0) {
    return " · 📧 complaint pause"
  }
  if (
    args.launchFollowupDeliveryRatePct > 0 &&
    args.launchFollowupDeliveryRatePct < EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT
  ) {
    return " · 🔴 delivery pause"
  }
  return " · ⏸ paused"
}

export function shouldShowFollowupPausedDigestRow(args: {
  launchFollowupPaused: boolean
}): boolean {
  return args.launchFollowupPaused
}

export function followupPausedDigestExportSuffix(args: {
  adminUrl: string
  countryIso2: string
  launchFollowupComplaintsThisMonth: number
  launchFollowupDeliveryRatePct: number
}): string {
  const links: string[] = []
  if (args.launchFollowupComplaintsThisMonth > 0) {
    links.push(
      `complaints ${args.adminUrl}${expansionComplaintsExportPath(args.countryIso2, "checkout-launch-followup")}`
    )
  }
  if (
    args.launchFollowupDeliveryRatePct > 0 &&
    args.launchFollowupDeliveryRatePct < EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT
  ) {
    links.push(
      `delivered ${args.adminUrl}${expansionDeliveredExportPath(args.countryIso2, "checkout-launch-followup")}`
    )
  }
  if (links.length === 0) {
    links.push(
      `bundle ${args.adminUrl}${expansionEmailExportsBundlePath(args.countryIso2, "checkout-launch-followup")}`
    )
  }
  return ` — ${links.join(" · ")}`
}
