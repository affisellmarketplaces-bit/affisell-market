import type { SupplierBookingRosterRow } from "@/lib/supplier-booking-roster-payload"

function escapeIcal(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")
}

function formatIcalUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

export function buildSupplierBookingRosterIcal(
  rows: SupplierBookingRosterRow[],
  calendarName = "Affisell Bookings"
): string {
  const events = rows
    .filter((row) => row.slotStartsAt)
    .map((row) => {
      const start = new Date(row.slotStartsAt!)
      const end = row.slotEndsAt ? new Date(row.slotEndsAt) : new Date(start.getTime() + 60 * 60 * 1000)
      if (!Number.isFinite(start.getTime())) return null
      const endSafe = Number.isFinite(end.getTime()) ? end : new Date(start.getTime() + 60 * 60 * 1000)
      const seats =
        row.seatLabels.length > 0 ? row.seatLabels.join(", ") : `×${Math.max(1, row.quantity)}`
      const summary = escapeIcal(`${row.productName} · ${seats}`)
      const description = escapeIcal(
        [
          `Guest: ${row.customerEmail}`,
          row.venueLabel ? `Venue: ${row.venueLabel}` : null,
          row.slotLabel ? `Slot: ${row.slotLabel}` : null,
          row.checkedIn ? "Checked in" : "Pending check-in",
        ]
          .filter(Boolean)
          .join("\\n")
      )
      const uid = `affisell-booking-${row.orderId}@affisell.com`
      return [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${formatIcalUtc(new Date())}`,
        `DTSTART:${formatIcalUtc(start)}`,
        `DTEND:${formatIcalUtc(endSafe)}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        "END:VEVENT",
      ].join("\r\n")
    })
    .filter((block): block is string => block != null)

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Affisell//Booking Roster//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcal(calendarName)}`,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n")
}

export function rosterIcalFilename(slotId?: string | null): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return slotId ? `affisell-booking-${slotId.slice(0, 8)}-${stamp}.ics` : `affisell-booking-roster-${stamp}.ics`
}
