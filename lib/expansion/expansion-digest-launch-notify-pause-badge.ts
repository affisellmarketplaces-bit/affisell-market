import { EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT } from "@/lib/expansion/expansion-auto-pause-notify"
import {
  expansionComplaintsExportPath,
  expansionDeliveredExportPath,
  expansionEmailExportsBundlePath,
} from "@/lib/admin/expansion-email-export-kinds"

export function launchNotifyPausedDigestBadge(args: {
  launchComplaintsThisMonth: number
  launchDeliveryRatePct: number
}): string {
  if (args.launchComplaintsThisMonth > 0) {
    return " · 📧 complaint pause"
  }
  if (
    args.launchDeliveryRatePct > 0 &&
    args.launchDeliveryRatePct < EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT
  ) {
    return " · 🔴 delivery pause"
  }
  return " · ⏸ paused"
}

export function launchNotifyPausedDigestExportSuffix(args: {
  adminUrl: string
  countryIso2: string
  launchComplaintsThisMonth: number
  launchDeliveryRatePct: number
}): string {
  const links: string[] = []
  if (args.launchComplaintsThisMonth > 0) {
    links.push(
      `complaints ${args.adminUrl}${expansionComplaintsExportPath(args.countryIso2, "checkout-launch")}`
    )
  }
  if (
    args.launchDeliveryRatePct > 0 &&
    args.launchDeliveryRatePct < EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT
  ) {
    links.push(
      `delivered ${args.adminUrl}${expansionDeliveredExportPath(args.countryIso2, "checkout-launch")}`
    )
  }
  if (links.length === 0) {
    links.push(`bundle ${args.adminUrl}${expansionEmailExportsBundlePath(args.countryIso2, "checkout-launch")}`)
  }
  return ` — ${links.join(" · ")}`
}
