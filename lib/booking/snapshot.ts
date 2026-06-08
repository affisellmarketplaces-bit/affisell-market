import type { BookingSnapshot } from "@/lib/booking/types"

export function buildBookingSnapshot(args: {
  slotId: string
  startsAt: Date
  endsAt: Date
  label: string | null
  venueLabel: string | null
  quantity: number
  cancellationPolicyHours: number
  listingKind: string
  productName: string
}): BookingSnapshot {
  return {
    slotId: args.slotId,
    startsAt: args.startsAt.toISOString(),
    endsAt: args.endsAt.toISOString(),
    label: args.label,
    venueLabel: args.venueLabel,
    quantity: Math.max(1, args.quantity),
    cancellationPolicyHours: Math.max(0, args.cancellationPolicyHours),
    listingKind: args.listingKind.trim().toUpperCase(),
    productName: args.productName.trim(),
  }
}

export function parseBookingSnapshot(raw: unknown): BookingSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (typeof o.slotId !== "string" || typeof o.startsAt !== "string" || typeof o.endsAt !== "string") {
    return null
  }
  return {
    slotId: o.slotId,
    startsAt: o.startsAt,
    endsAt: o.endsAt,
    label: typeof o.label === "string" ? o.label : null,
    venueLabel: typeof o.venueLabel === "string" ? o.venueLabel : null,
    quantity: typeof o.quantity === "number" && o.quantity >= 1 ? Math.round(o.quantity) : 1,
    cancellationPolicyHours:
      typeof o.cancellationPolicyHours === "number" && o.cancellationPolicyHours >= 0
        ? Math.round(o.cancellationPolicyHours)
        : 24,
    listingKind: typeof o.listingKind === "string" ? o.listingKind : "SERVICE",
    productName: typeof o.productName === "string" ? o.productName : "",
  }
}
