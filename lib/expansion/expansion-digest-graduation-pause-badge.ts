import { EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT } from "@/lib/expansion/expansion-auto-pause-notify"
import {
  expansionComplaintsExportPath,
  expansionDeliveredExportPath,
  expansionEmailExportsBundlePath,
} from "@/lib/admin/expansion-email-export-kinds"

export function graduationPausedDigestBadge(args: {
  launchGraduatedComplaintsThisMonth: number
  launchGraduatedDeliveryRatePct: number
}): string {
  if (args.launchGraduatedComplaintsThisMonth > 0) {
    return " · 📧 complaint pause"
  }
  if (
    args.launchGraduatedDeliveryRatePct > 0 &&
    args.launchGraduatedDeliveryRatePct < EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT
  ) {
    return " · 🔴 delivery pause"
  }
  return " · ⏸ paused"
}

export function shouldShowGraduationPausedDigestRow(args: {
  graduationEmailPaused: boolean
}): boolean {
  return args.graduationEmailPaused
}

export function graduationPausedDigestExportSuffix(args: {
  adminUrl: string
  countryIso2: string
  launchGraduatedComplaintsThisMonth: number
  launchGraduatedDeliveryRatePct: number
}): string {
  const links: string[] = []
  if (args.launchGraduatedComplaintsThisMonth > 0) {
    links.push(
      `complaints ${args.adminUrl}${expansionComplaintsExportPath(args.countryIso2, "checkout-graduated")}`
    )
  }
  if (
    args.launchGraduatedDeliveryRatePct > 0 &&
    args.launchGraduatedDeliveryRatePct < EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT
  ) {
    links.push(
      `delivered ${args.adminUrl}${expansionDeliveredExportPath(args.countryIso2, "checkout-graduated")}`
    )
  }
  if (links.length === 0) {
    links.push(`bundle ${args.adminUrl}${expansionEmailExportsBundlePath(args.countryIso2, "checkout-graduated")}`)
  }
  return ` — ${links.join(" · ")}`
}
