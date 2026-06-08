const HOUR_MS = 60 * 60 * 1000

/** Extra minutes after hold expiry before cron releases inventory (slow Stripe webhook). */
export function bookingHoldConfirmGraceMinutes(): number {
  const raw = Number(process.env.BOOKING_HOLD_CONFIRM_GRACE_MINUTES)
  if (Number.isFinite(raw) && raw >= 1 && raw <= 30) return Math.round(raw)
  return 5
}

export function bookingHoldConfirmGraceMs(): number {
  return bookingHoldConfirmGraceMinutes() * 60 * 1000
}

/** Hold is stale only after expiry + grace (cron should not release earlier). */
export function bookingHoldStaleBefore(now: Date = new Date()): Date {
  return new Date(now.getTime() - bookingHoldConfirmGraceMs())
}

export function isHoldExpiredBeyondGrace(holdExpiresAt: Date | null, now: Date = new Date()): boolean {
  if (!holdExpiresAt) return false
  return holdExpiresAt.getTime() < bookingHoldStaleBefore(now).getTime()
}
