/**
 * Stripe-side half of the money sentinel: the database can only show what it recorded, and a legacy path may have
 * paid without writing a ledger row. This reads what Stripe itself holds and flags every beneficiary paid more than
 * once for the same order: same `transfer_group`, same destination, role equal whatever its case (or absent), not
 * fully reversed. Pure — fed by `scripts/report-stripe-transfer-duplicates.ts` (read-only) or by tests.
 *
 * First run (Stripe Test, 2026-11-27): 5 orders, 12 transfers, 8 extra = 698.88 EUR, all on 24/05/2026 with a
 * lowercase `supplier` role and no source transaction.
 */
export type StripeTransferLite = {
  id: string
  amount: number
  amount_reversed?: number | null
  created: number
  destination: string | { id: string } | null
  transfer_group: string | null
  metadata?: Record<string, string | undefined> | null
}

export type TransferDuplicate = {
  transferGroup: string
  destination: string
  role: string | null
  transferIds: string[]
  amounts: number[]
  extraCount: number
  /** What left beyond the first transfer, net of reversals. */
  extraCents: number
  firstCreated: number
  lastCreated: number
}

const destOf = (d: StripeTransferLite["destination"]) => (typeof d === "string" ? d : (d?.id ?? null))
const netOf = (t: StripeTransferLite) => Math.max(0, t.amount - Math.max(0, t.amount_reversed ?? 0))

export function findStripeTransferDuplicates(transfers: readonly StripeTransferLite[]): TransferDuplicate[] {
  const groups = new Map<string, StripeTransferLite[]>()
  for (const t of transfers) {
    const dest = destOf(t.destination)
    if (!t.transfer_group || !dest || netOf(t) === 0) continue
    // Roles are compared case-insensitively; a role-less transfer joins the beneficiary's bucket (fail-safe).
    const key = `${t.transfer_group}\u0000${dest}`
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  const out: TransferDuplicate[] = []
  for (const [key, list] of groups) {
    const roles = new Set(list.map((t) => t.metadata?.role?.toUpperCase()).filter((r): r is string => Boolean(r)))
    // Two different roles to one account (supplier = reseller) are two legs, not a duplicate: split by role then.
    const buckets =
      roles.size > 1 ? [...roles].map((r) => list.filter((t) => (t.metadata?.role ?? "").toUpperCase() === r)) : [list]
    for (const bucket of buckets) {
      if (bucket.length < 2) continue
      const sorted = [...bucket].sort((a, b) => a.created - b.created)
      const [group, destination] = key.split("\u0000") as [string, string]
      out.push({
        transferGroup: group,
        destination,
        role: sorted.find((t) => t.metadata?.role)?.metadata?.role?.toUpperCase() ?? null,
        transferIds: sorted.map((t) => t.id),
        amounts: sorted.map((t) => t.amount),
        extraCount: sorted.length - 1,
        extraCents: sorted.slice(1).reduce((s, t) => s + netOf(t), 0),
        firstCreated: sorted[0]!.created,
        lastCreated: sorted[sorted.length - 1]!.created,
      })
    }
  }
  return out.sort((a, b) => b.extraCents - a.extraCents)
}
