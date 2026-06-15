export function followupComplaintDigestBadge(args: {
  launchFollowupComplaintsThisMonth: number
  launchFollowupPaused: boolean
}): string {
  if (args.launchFollowupPaused && args.launchFollowupComplaintsThisMonth > 0) {
    return " · 🔴 auto-paused"
  }
  if (args.launchFollowupComplaintsThisMonth > 0) {
    return " · 📧 complaint alert"
  }
  return ""
}

export function shouldShowFollowupComplaintDigestRow(args: {
  launchFollowupComplaintsThisMonth: number
}): boolean {
  return args.launchFollowupComplaintsThisMonth > 0
}

export function shouldShowFollowupComplaintAlertDigestRow(args: {
  launchFollowupSentThisMonth: number
  launchFollowupComplaintsThisMonth: number
}): boolean {
  return args.launchFollowupSentThisMonth >= 10 && args.launchFollowupComplaintsThisMonth > 0
}

export function shouldShowFollowupDeliveredDigestRow(args: {
  followUpCount: number
  launchFollowupDeliveredThisMonth: number
}): boolean {
  return args.followUpCount >= 10 && args.launchFollowupDeliveredThisMonth > 0
}
