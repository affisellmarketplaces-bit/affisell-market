export const SUPPRESSED_WAITLIST_PURGE_AFTER_DAYS = 90

export function suppressedWaitlistPurgeCutoff(now = new Date()): Date {
  return new Date(now.getTime() - SUPPRESSED_WAITLIST_PURGE_AFTER_DAYS * 86_400_000)
}

export function isSuppressedWaitlistStale(
  launchEmailSuppressedAt: Date,
  now = new Date()
): boolean {
  return launchEmailSuppressedAt.getTime() < suppressedWaitlistPurgeCutoff(now).getTime()
}
