export const EXPANSION_COMPLAINT_ALERT_MIN_NOTIFIED = 10
export const EXPANSION_AUTO_PAUSE_COMPLAINT_MIN_COUNT = 1

export function computeCountryComplaintRatePct(args: {
  complaintsThisMonth: number
  notifiedCount: number
}): number {
  if (args.complaintsThisMonth === 0 || args.notifiedCount === 0) return 0
  return Math.min(
    100,
    Math.round((args.complaintsThisMonth / args.notifiedCount) * 1000) / 10
  )
}

export function shouldAlertCountryComplaint(args: {
  complaintsThisMonth: number
  notifiedCount: number
  minNotified?: number
}): boolean {
  const minNotified = args.minNotified ?? EXPANSION_COMPLAINT_ALERT_MIN_NOTIFIED
  if (args.notifiedCount < minNotified) return false
  return args.complaintsThisMonth > 0
}

export function shouldAutoPauseLaunchNotifyOnComplaint(args: {
  complaintsThisMonth: number
  notifiedCount: number
  minNotified?: number
  minComplaints?: number
}): boolean {
  const minNotified = args.minNotified ?? EXPANSION_COMPLAINT_ALERT_MIN_NOTIFIED
  const minComplaints = args.minComplaints ?? EXPANSION_AUTO_PAUSE_COMPLAINT_MIN_COUNT
  if (args.notifiedCount < minNotified) return false
  return args.complaintsThisMonth >= minComplaints
}
