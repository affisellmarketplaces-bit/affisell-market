import {
  isShipDeadlineBreached,
  isShipDeadlineCritical,
} from "@/lib/supplier-ship-sla-shared"

export type SupplierOrdersSort = "urgency" | "date_desc" | "date_asc"

export type SupplierOrdersSortRow = {
  createdAt: string
  shipPulse: { msRemaining: number } | null
}

function compareCreatedAt(a: SupplierOrdersSortRow, b: SupplierOrdersSortRow, dir: "asc" | "desc"): number {
  const ta = new Date(a.createdAt).getTime()
  const tb = new Date(b.createdAt).getTime()
  return dir === "desc" ? tb - ta : ta - tb
}

function sortByShipPulseUrgency<T extends SupplierOrdersSortRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aLate = isShipDeadlineBreached(a.shipPulse)
    const bLate = isShipDeadlineBreached(b.shipPulse)
    if (aLate !== bLate) return aLate ? -1 : 1
    const aCritical = isShipDeadlineCritical(a.shipPulse)
    const bCritical = isShipDeadlineCritical(b.shipPulse)
    if (aCritical !== bCritical) return aCritical ? -1 : 1
    const aMs = a.shipPulse?.msRemaining ?? Number.POSITIVE_INFINITY
    const bMs = b.shipPulse?.msRemaining ?? Number.POSITIVE_INFINITY
    if (aMs !== bMs) return aMs - bMs
    return compareCreatedAt(a, b, "desc")
  })
}

/** Sort supplier inbox rows — urgency default on “to ship”, date elsewhere. */
export function sortSupplierOrderRows<T extends SupplierOrdersSortRow>(
  rows: T[],
  opts: { tab: "to_ship" | "shipped" | "all"; sort: SupplierOrdersSort }
): T[] {
  if (opts.sort === "date_desc") {
    return [...rows].sort((a, b) => compareCreatedAt(a, b, "desc"))
  }
  if (opts.sort === "date_asc") {
    return [...rows].sort((a, b) => compareCreatedAt(a, b, "asc"))
  }
  if (opts.tab === "to_ship") {
    return sortByShipPulseUrgency(rows)
  }
  return [...rows].sort((a, b) => compareCreatedAt(a, b, "desc"))
}

export function defaultSupplierOrdersSort(tab: "to_ship" | "shipped" | "all"): SupplierOrdersSort {
  return tab === "to_ship" ? "urgency" : "date_desc"
}
