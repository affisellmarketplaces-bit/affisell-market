export function graduationComplaintDigestBadge(args: {
  launchGraduatedComplaintRatePct: number
  graduationEmailPaused: boolean
}): string {
  if (args.graduationEmailPaused) {
    return " · 🔴 auto-paused"
  }
  if (args.launchGraduatedComplaintRatePct > 0) {
    return " · 📧 complaint alert"
  }
  return ""
}

export function shouldShowGraduationComplaintDigestRow(args: {
  launchGraduatedSentThisMonth: number
  launchGraduatedComplaintsThisMonth: number
}): boolean {
  return args.launchGraduatedSentThisMonth >= 10 && args.launchGraduatedComplaintsThisMonth > 0
}
