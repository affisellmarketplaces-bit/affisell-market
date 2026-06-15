export const EXPANSION_COMPLAINT_CLEAR_RESUME_DAYS = 30

export function expansionComplaintClearCutoff(now = new Date()): Date {
  return new Date(now.getTime() - EXPANSION_COMPLAINT_CLEAR_RESUME_DAYS * 86_400_000)
}

export function isComplaintPauseReason(reason: string | null | undefined): boolean {
  return typeof reason === "string" && reason.startsWith("complaint_")
}

export function shouldAutoResumeLaunchNotifyAfterComplaintClear(args: {
  complaintsSinceCutoff: number
  pausedReason: string | null | undefined
}): boolean {
  if (!isComplaintPauseReason(args.pausedReason)) return false
  return args.complaintsSinceCutoff === 0
}
