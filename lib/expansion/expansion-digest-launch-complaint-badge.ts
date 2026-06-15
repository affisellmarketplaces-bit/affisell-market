export function launchComplaintDigestBadge(launchComplaintRatePct: number): string {
  if (launchComplaintRatePct > 0) {
    return " · 📧 complaint alert"
  }
  return ""
}

export function shouldShowLaunchComplaintDigestRow(args: {
  launchComplaintsThisMonth: number
}): boolean {
  return args.launchComplaintsThisMonth > 0
}
