/**
 * Chantier 6 — READ-ONLY: money the settlement owes to partners who have no Stripe Connect account.
 *
 * `scheduleMarketplaceTransferAttempts` creates a transfer only for a party that HAS a destination; a party without
 * one gets no `TransferAttempt` row at all, and nothing re-schedules it once the account exists (`missing_connect_account`
 * is returned and forgotten). This module measures that debt — it pays nothing, schedules nothing, writes nothing.
 *
 * Amounts are the settlement's own planned legs (same functions as the scheduler), BEFORE any partial refund:
 * a refund reverses transfers pro rata, so a partially refunded order's real debt is lower — labelled an estimate.
 * Closed orders (refunded / cancelled) owe nothing. The platform auto-buy account (Affisell itself, path B) is excluded:
 * Affisell does not owe itself a transfer.
 */
export type OwedLeg = {
  role: "SUPPLIER" | "AFFILIATE"
  partnerId: string
  orderId: string
  amountCents: number
  paidAt: Date | null
}

export type OwedPartner = {
  role: "SUPPLIER" | "AFFILIATE"
  partnerId: string
  orders: number
  owedCents: number
  oldestPaidAt: string | null
}

export function aggregateOwedLegs(legs: ReadonlyArray<OwedLeg>): { partners: OwedPartner[]; totalCents: number } {
  const map = new Map<string, OwedPartner & { oldest: number | null }>()
  for (const leg of legs) {
    if (!(leg.amountCents > 0)) continue
    const key = `${leg.role}:${leg.partnerId}`
    const cur = map.get(key) ?? { role: leg.role, partnerId: leg.partnerId, orders: 0, owedCents: 0, oldestPaidAt: null, oldest: null }
    cur.orders += 1
    cur.owedCents += Math.round(leg.amountCents)
    const t = leg.paidAt ? leg.paidAt.getTime() : null
    if (t != null && (cur.oldest == null || t < cur.oldest)) cur.oldest = t
    map.set(key, cur)
  }
  const partners = [...map.values()]
    .map(({ oldest, ...p }) => ({ ...p, oldestPaidAt: oldest != null ? new Date(oldest).toISOString() : null }))
    .sort((a, b) => b.owedCents - a.owedCents)
  return { partners, totalCents: partners.reduce((s, p) => s + p.owedCents, 0) }
}

/** Which legs of one order are owed and unscheduled because the partner has no destination. Pure. */
export function owedLegsForOrder(args: {
  orderId: string
  paidAt: Date | null
  supplierId: string
  affiliateId: string | null
  supplierHasConnect: boolean
  affiliateHasConnect: boolean
  supplierIsPlatform: boolean
  plannedSupplierCents: number
  plannedAffiliateCents: number
  attemptRoles: ReadonlyArray<string>
}): OwedLeg[] {
  const out: OwedLeg[] = []
  if (!args.supplierIsPlatform && !args.supplierHasConnect && args.plannedSupplierCents > 0 && !args.attemptRoles.includes("SUPPLIER")) {
    out.push({ role: "SUPPLIER", partnerId: args.supplierId, orderId: args.orderId, amountCents: args.plannedSupplierCents, paidAt: args.paidAt })
  }
  if (
    args.affiliateId &&
    !args.affiliateHasConnect &&
    args.plannedAffiliateCents > 0 &&
    !args.attemptRoles.includes("AFFILIATE")
  ) {
    out.push({ role: "AFFILIATE", partnerId: args.affiliateId, orderId: args.orderId, amountCents: args.plannedAffiliateCents, paidAt: args.paidAt })
  }
  return out
}
