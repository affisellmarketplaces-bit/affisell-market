import { randomBytes } from "node:crypto"

export const BOOKING_TRACKING_CARRIER = "AFFISELL_BOOKING"
export const BOOKING_DELIVERY_CONFIRMED_BY = "booking_instant"

export function generateBookingPassToken(): string {
  return randomBytes(24).toString("hex")
}

export function bookingPassPath(token: string): string {
  return `/booking/pass/${encodeURIComponent(token)}`
}
