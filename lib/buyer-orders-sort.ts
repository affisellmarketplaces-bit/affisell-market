export type BuyerOrdersSort =
  | "action_needed"
  | "date_desc"
  | "date_asc"
  | "amount_desc"
  | "amount_asc"

export type BuyerOrdersSortRow = {
  createdAt: string
  sellingPriceCents: number
  canConfirmDelivery: boolean
  canCancelBooking: boolean
  activeReturn: { status: string } | null
  status: string
}

function compareCreatedAt(a: BuyerOrdersSortRow, b: BuyerOrdersSortRow, dir: "asc" | "desc"): number {
  const ta = new Date(a.createdAt).getTime()
  const tb = new Date(b.createdAt).getTime()
  return dir === "desc" ? tb - ta : ta - tb
}

function compareAmount(a: BuyerOrdersSortRow, b: BuyerOrdersSortRow, dir: "asc" | "desc"): number {
  const diff =
    dir === "desc"
      ? b.sellingPriceCents - a.sellingPriceCents
      : a.sellingPriceCents - b.sellingPriceCents
  if (diff !== 0) return diff
  return compareCreatedAt(a, b, "desc")
}

/** Higher score = buyer should act sooner (confirm delivery, return ship-back, etc.). */
export function buyerOrderActionPriority(row: BuyerOrdersSortRow): number {
  if (row.canConfirmDelivery) return 100
  if (row.activeReturn?.status === "AWAITING_SHIPMENT") return 90
  if (row.canCancelBooking) return 80
  if (row.activeReturn?.status === "REQUESTED") return 70
  if (row.activeReturn?.status === "IN_TRANSIT") return 50
  if (row.status === "preparing") return 20
  return 0
}

export function sortBuyerOrderRows<T extends BuyerOrdersSortRow>(rows: T[], sort: BuyerOrdersSort): T[] {
  if (sort === "date_desc") {
    return [...rows].sort((a, b) => compareCreatedAt(a, b, "desc"))
  }
  if (sort === "date_asc") {
    return [...rows].sort((a, b) => compareCreatedAt(a, b, "asc"))
  }
  if (sort === "amount_desc") {
    return [...rows].sort((a, b) => compareAmount(a, b, "desc"))
  }
  if (sort === "amount_asc") {
    return [...rows].sort((a, b) => compareAmount(a, b, "asc"))
  }
  return [...rows].sort((a, b) => {
    const priorityDiff = buyerOrderActionPriority(b) - buyerOrderActionPriority(a)
    if (priorityDiff !== 0) return priorityDiff
    return compareCreatedAt(a, b, "desc")
  })
}

export function defaultBuyerOrdersSort(): BuyerOrdersSort {
  return "action_needed"
}
