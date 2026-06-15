export function launchComplaintDigestBadge(launchComplaintRatePct: number): string {
  if (launchComplaintRatePct > 0) {
    return " · 📧 complaint alert"
  }
  return ""
}

export function launchComplaintAlertDigestBadge(args: {
  launchComplaintRatePct: number
  launchNotifyPaused: boolean
}): string {
  if (args.launchNotifyPaused && args.launchComplaintRatePct > 0) {
    return " · 🔴 auto-paused"
  }
  if (args.launchComplaintRatePct > 0) {
    return " · 📧 complaint alert"
  }
  return ""
}

export function shouldShowLaunchComplaintDigestRow(args: {
  launchComplaintsThisMonth: number
}): boolean {
  return args.launchComplaintsThisMonth > 0
}

export function shouldShowLaunchComplaintAlertDigestRow(args: {
  notifiedCount: number
  launchComplaintsThisMonth: number
}): boolean {
  return args.notifiedCount >= 10 && args.launchComplaintsThisMonth > 0
}
