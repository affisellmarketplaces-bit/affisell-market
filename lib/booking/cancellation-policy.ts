import { parseBookingSnapshot } from "@/lib/booking/snapshot"

export const DEFAULT_BOOKING_CANCELLATION_HOURS = 24

export function hoursUntilBookingStart(startsAt: Date, now = new Date()): number {
  return (startsAt.getTime() - now.getTime()) / (60 * 60 * 1000)
}

/** Buyer may cancel (and request refund) when still inside the free window before start. */
export function canBuyerCancelBooking(args: {
  bookingSnapshot: unknown
  bookingConfirmedAt: Date | null
  now?: Date
}): { allowed: boolean; reason?: "missing_snapshot" | "past_deadline" | "not_confirmed" } {
  if (!args.bookingConfirmedAt) {
    return { allowed: false, reason: "not_confirmed" }
  }
  const snapshot = parseBookingSnapshot(args.bookingSnapshot)
  if (!snapshot) {
    return { allowed: false, reason: "missing_snapshot" }
  }
  const startsAt = new Date(snapshot.startsAt)
  if (!Number.isFinite(startsAt.getTime())) {
    return { allowed: false, reason: "missing_snapshot" }
  }
  const now = args.now ?? new Date()
  const hoursLeft = hoursUntilBookingStart(startsAt, now)
  if (hoursLeft <= snapshot.cancellationPolicyHours) {
    return { allowed: false, reason: "past_deadline" }
  }
  return { allowed: true }
}

export function bookingCancellationDeadlineAt(startsAt: Date, policyHours: number): Date {
  return new Date(startsAt.getTime() - policyHours * 60 * 60 * 1000)
}
