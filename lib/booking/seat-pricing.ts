import {
  buildSeatLayout,
  resolveSeatLayoutConfig,
  type BookingSeatLayoutConfig,
} from "@/lib/booking/seat-layout"
import { isExperienceListingKind } from "@/lib/booking/types"

export type BookingSeatPricingBreakdown = {
  unitSellingCents: number
  quantity: number
  vipSeatCount: number
  vipSurchargePerSeatCents: number
  vipSurchargeTotalCents: number
  lineSubtotalCents: number
}

export function countVipSeatsInSelection(args: {
  seatLabels: string[]
  quantity: number
  listingKind: string
  seatLayout: BookingSeatLayoutConfig | null | undefined
}): number {
  if (!isExperienceListingKind(args.listingKind) || args.seatLabels.length === 0) return 0
  const config = resolveSeatLayoutConfig(args.seatLayout, args.listingKind)
  const layout = buildSeatLayout(
    Math.max(args.quantity, args.seatLabels.length),
    config
  )
  const vipLabels = new Set(layout.filter((c) => c.tier === "VIP").map((c) => c.label))
  return args.seatLabels.filter((l) => vipLabels.has(l)).length
}

export function computeBookingLineSubtotalCents(args: {
  unitSellingCents: number
  quantity: number
  seatLabels: string[]
  listingKind: string
  seatLayout: BookingSeatLayoutConfig | null | undefined
}): BookingSeatPricingBreakdown {
  const qty = Math.max(1, Math.round(args.quantity))
  const config = resolveSeatLayoutConfig(args.seatLayout, args.listingKind)
  const surchargePerSeat = Math.max(0, config.vipSeatSurchargeCents ?? 0)
  const vipSeatCount = countVipSeatsInSelection({
    seatLabels: args.seatLabels,
    quantity: qty,
    listingKind: args.listingKind,
    seatLayout: config,
  })
  const vipSurchargeTotalCents = vipSeatCount * surchargePerSeat
  const base = args.unitSellingCents * qty

  return {
    unitSellingCents: args.unitSellingCents,
    quantity: qty,
    vipSeatCount,
    vipSurchargePerSeatCents: surchargePerSeat,
    vipSurchargeTotalCents,
    lineSubtotalCents: base + vipSurchargeTotalCents,
  }
}
