import type { SupplierBookingRosterRow } from "@/lib/supplier-booking-roster-payload"

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildSupplierBookingRosterCsv(rows: SupplierBookingRosterRow[]): string {
  const header = [
    "order_id",
    "customer_email",
    "product",
    "slot_starts_at",
    "slot_label",
    "venue",
    "seats",
    "quantity",
    "status",
    "checked_in_at",
  ]

  const lines = rows.map((row) => {
    const status = row.checkedIn ? "checked_in" : "pending"
    return [
      row.orderId,
      row.customerEmail,
      row.productName,
      row.slotStartsAt ?? "",
      row.slotLabel ?? "",
      row.venueLabel ?? "",
      row.seatLabels.join(" "),
      String(row.quantity),
      status,
      row.bookingCheckedInAt ?? "",
    ]
      .map((cell) => escapeCsvCell(cell))
      .join(",")
  })

  return [header.join(","), ...lines].join("\n")
}

export function rosterCsvFilename(slotId?: string): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return slotId ? `booking-roster-${slotId.slice(0, 8)}-${stamp}.csv` : `booking-roster-${stamp}.csv`
}
