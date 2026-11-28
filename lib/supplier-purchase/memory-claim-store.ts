import type { ClaimRow, ClaimStore } from "@/lib/supplier-purchase/guard.server"

type Row = ClaimRow & {
  channel: string
  path: string
  paymentRef: string | null
  error: string | null
  updatedAt: number
}

/**
 * In-memory ClaimStore with the SAME semantics as the SQL one (all-or-nothing claim, only an unpaid `rejected` is
 * re-claimable, settle only from `claimed` with the holder's token, a paid `rejected` becomes `uncertain`, wallet
 * debit and payment stamp together or not at all) — for tests. The SQL itself is proven against PostgreSQL in
 * scripts/sql/test-supplier-purchase-claim.ts.
 */
export function memoryClaimStore(wallets: Record<string, number> = {}): ClaimStore & {
  rows: Map<string, Row>
  wallets: Record<string, number>
} {
  const rows = new Map<string, Row>()
  const heldBy = (keys: string[], token: string) =>
    keys.every((k) => rows.get(k)?.status === "claimed" && rows.get(k)?.token === token)
  return {
    rows,
    wallets,
    async tryClaimAll(keys, channel, path, token, dailyLimit) {
      if (keys.some((k) => rows.has(k) && !(rows.get(k)!.status === "rejected" && rows.get(k)!.paidCents == null)))
        return false
      if (dailyLimit !== undefined && dailyLimit !== null) {
        const since = Date.now() - 24 * 3600_000
        const tokens = new Set(
          [...rows.values()]
            .filter((r) => r.channel === channel && r.status !== "rejected" && r.updatedAt >= since)
            .map((r) => r.token),
        )
        if (tokens.size >= dailyLimit) return "daily_limit_reached"
      }
      for (const k of keys) {
        const prev = rows.get(k)
        rows.set(k, {
          status: "claimed",
          supplierOrderId: null,
          attempts: (prev?.attempts ?? 0) + 1,
          token,
          paidCents: null,
          paymentRef: null,
          error: null,
          channel,
          path,
          updatedAt: Date.now(),
        })
      }
      return true
    },
    async readAll(keys) {
      return keys.filter((k) => rows.has(k)).map((k) => ({ id: k, ...rows.get(k)! }))
    },
    async settleAll(keys, token, status, supplierOrderId, error) {
      for (const k of keys) {
        const r = rows.get(k)
        if (!r || r.status !== "claimed" || r.token !== token) continue
        const paidRejected = status === "rejected" && r.paidCents != null
        rows.set(k, {
          ...r,
          status: paidRejected ? "uncertain" : status,
          supplierOrderId,
          error: paidRejected ? `paid_but_not_placed: ${error ?? ""}` : error,
          updatedAt: Date.now(),
        })
      }
    },
    async recordPayment(keys, token, paymentRef, cents) {
      if (!heldBy(keys, token) || keys.some((k) => rows.get(k)!.paidCents != null)) return false
      for (const k of keys) rows.set(k, { ...rows.get(k)!, paidCents: cents, paymentRef })
      return true
    },
    async debitWalletForClaim(keys, token, providerId, cents) {
      if (!heldBy(keys, token) || keys.some((k) => rows.get(k)!.paidCents != null)) return "already_paid_or_not_held"
      if ((wallets[providerId] ?? 0) < cents) return "insufficient_wallet_balance"
      wallets[providerId] = (wallets[providerId] ?? 0) - cents
      for (const k of keys) rows.set(k, { ...rows.get(k)!, paidCents: cents, paymentRef: `wallet:${providerId}` })
      return "debited"
    },
  }
}
