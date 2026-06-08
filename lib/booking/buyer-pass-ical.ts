import { bookingPassPath } from "@/lib/booking/pass-token"
import type { BookingSnapshot } from "@/lib/booking/types"
import { buildIcalCalendar, escapeIcal, formatIcalUtc } from "@/lib/booking/ical-format"

export function buildBuyerBookingPassIcal(args: {
  orderId: string
  productName: string
  bookingToken: string
  snapshot: BookingSnapshot
  passBaseUrl: string
}): string {
  const start = new Date(args.snapshot.startsAt)
  const end = new Date(args.snapshot.endsAt)
  if (!Number.isFinite(start.getTime())) {
    throw new Error("invalid_starts_at")
  }
  const endSafe = Number.isFinite(end.getTime()) ? end : new Date(start.getTime() + 60 * 60 * 1000)
  const passUrl = `${args.passBaseUrl}${bookingPassPath(args.bookingToken)}`
  const seats =
    args.snapshot.seatLabels.length > 0
      ? args.snapshot.seatLabels.join(", ")
      : `×${Math.max(1, args.snapshot.quantity)}`

  const summary = escapeIcal(`${args.productName} · ${seats}`)
  const description = escapeIcal(
    [
      args.snapshot.venueLabel ? `Venue: ${args.snapshot.venueLabel}` : null,
      args.snapshot.label ? `Slot: ${args.snapshot.label}` : null,
      `Pass: ${passUrl}`,
      `Order: ${args.orderId}`,
    ]
      .filter(Boolean)
      .join("\\n")
  )

  const event = [
    "BEGIN:VEVENT",
    `UID:affisell-buyer-${args.orderId}@affisell.com`,
    `DTSTAMP:${formatIcalUtc(new Date())}`,
    `DTSTART:${formatIcalUtc(start)}`,
    `DTEND:${formatIcalUtc(endSafe)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `URL:${escapeIcal(passUrl)}`,
    "END:VEVENT",
  ].join("\r\n")

  return buildIcalCalendar([event], `Affisell · ${args.productName}`)
}

export function buyerPassIcalFilename(orderId: string): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return `affisell-booking-${orderId.slice(0, 8)}-${stamp}.ics`
}
