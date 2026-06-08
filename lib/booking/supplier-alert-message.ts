import { maskEmailForLog } from "@/lib/emails/mask-email"
import { bookingVerticalCopyFamily } from "@/lib/booking/vertical-copy"
import type { BookingSnapshot } from "@/lib/booking/types"

function inboxKindLabel(listingKind: string): string {
  const family = bookingVerticalCopyFamily(listingKind)
  if (family === "restaurant") return "Table"
  if (family === "museum") return "Visite"
  if (family === "experience") return "Séance"
  return "RDV"
}

export function formatSupplierBookingConfirmedInbox(args: {
  productName: string
  listingKind: string
  quantity: number
  startsAtIso: string
  seatLabels: string[]
  customerEmail: string
}): string {
  const family = bookingVerticalCopyFamily(args.listingKind)
  const when = formatWhenShort(args.startsAtIso)
  const seats =
    args.seatLabels.length > 0
      ? ` · ${args.seatLabels.join(", ")}`
      : family !== "service"
        ? ` · ×${args.quantity}`
        : ""
  const kind = inboxKindLabel(args.listingKind)
  return `Réservation confirmée · ${kind} ${when} · ${args.productName}${seats} · ${maskEmailForLog(args.customerEmail)}`
}

function formatWhenShort(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
}

export function bookingSnapshotForSupplierAlert(snapshot: BookingSnapshot): {
  startsAt: string
  seatLabels: string[]
  quantity: number
  venueLabel: string | null
} {
  return {
    startsAt: snapshot.startsAt,
    seatLabels: snapshot.seatLabels,
    quantity: snapshot.quantity,
    venueLabel: snapshot.venueLabel,
  }
}
