import { maskEmailForLog } from "@/lib/emails/mask-email"
import { isExperienceListingKind } from "@/lib/booking/types"
import type { BookingSnapshot } from "@/lib/booking/types"

export function formatSupplierBookingConfirmedInbox(args: {
  productName: string
  listingKind: string
  quantity: number
  startsAtIso: string
  seatLabels: string[]
  customerEmail: string
}): string {
  const experience = isExperienceListingKind(args.listingKind)
  const when = formatWhenShort(args.startsAtIso)
  const seats =
    args.seatLabels.length > 0
      ? ` · ${args.seatLabels.join(", ")}`
      : experience
        ? ` · ×${args.quantity}`
        : ""
  const kind = experience ? "Séance" : "RDV"
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
