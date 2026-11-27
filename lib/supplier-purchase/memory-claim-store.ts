import type { ClaimRow, ClaimStore } from "@/lib/supplier-purchase/guard.server"

/**
 * In-memory ClaimStore with the SAME semantics as the SQL one (all-or-nothing claim, only `rejected` re-claimable,
 * settle only from `claimed`) — for tests. The SQL itself is proven against PostgreSQL in
 * scripts/sql/test-supplier-purchase-claim.ts.
 */
export function memoryClaimStore(): ClaimStore & { rows: Map<string, ClaimRow & { channel: string; path: string }> } {
  const rows = new Map<string, ClaimRow & { channel: string; path: string }>()
  return {
    rows,
    async tryClaimAll(keys, channel, path) {
      if (keys.some((k) => rows.has(k) && rows.get(k)!.status !== "rejected")) return false
      for (const k of keys) {
        const prev = rows.get(k)
        rows.set(k, { status: "claimed", supplierOrderId: null, attempts: (prev?.attempts ?? 0) + 1, channel, path })
      }
      return true
    },
    async readAll(keys) {
      return keys.filter((k) => rows.has(k)).map((k) => ({ id: k, ...rows.get(k)! }))
    },
    async settleAll(keys, status, supplierOrderId) {
      for (const k of keys) {
        const r = rows.get(k)
        if (r && r.status === "claimed") rows.set(k, { ...r, status, supplierOrderId })
      }
    },
  }
}
