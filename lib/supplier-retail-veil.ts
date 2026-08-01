/**
 * Supplier Retail Veil — reseller / buyer retail € never crosses to SUPPLIER clients.
 * Wholesale liability only. Idempotent mappers; safe to call twice.
 */

import { resolveSupplierPayoutCentsFromOrder } from "@/lib/marketplace-order-settlement"
import type { ResolveOrderSupplierSettlementInput } from "@/lib/marketplace-supplier-fee"

/** Keys that must never appear in supplier-facing JSON payloads. */
export const SUPPLIER_RETAIL_FORBIDDEN_KEYS = [
  "sellingPriceCents",
  "marginCents",
  "affiliateMarginRetainedCents",
  "requestedRefundCents",
  "approvedRefundCents",
  "linePaidCents",
  "totalCents",
] as const

export type SupplierRetailForbiddenKey = (typeof SUPPLIER_RETAIL_FORBIDDEN_KEYS)[number]

/**
 * Supplier clawback exposure for a return, proportional to buyer refund / retail.
 * Inputs stay server-side; only the wholesale share is returned to the supplier.
 */
export function supplierReturnLiabilityCents(args: {
  order: ResolveOrderSupplierSettlementInput
  buyerRefundCents: number
  buyerSellCents: number
}): number {
  const net = resolveSupplierPayoutCentsFromOrder(args.order)
  const sell = Math.max(1, Math.round(args.buyerSellCents))
  const refund = Math.max(0, Math.round(args.buyerRefundCents))
  const frac = Math.min(1, refund / sell)
  return Math.round(net * frac)
}

/** Deep-scan JSON-like trees for forbidden retail keys (tests + hardening). */
export function collectSupplierRetailLeaks(
  payload: unknown,
  path = "$"
): Array<{ path: string; key: string }> {
  const hits: Array<{ path: string; key: string }> = []
  const forbidden = new Set<string>(SUPPLIER_RETAIL_FORBIDDEN_KEYS)

  const walk = (node: unknown, here: string) => {
    if (node == null || typeof node !== "object") return
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${here}[${i}]`))
      return
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const child = `${here}.${key}`
      if (forbidden.has(key)) {
        hits.push({ path: child, key })
      }
      walk(value, child)
    }
  }

  walk(payload, path)
  return hits
}

export function assertNoSupplierRetailLeak(payload: unknown): void {
  const leaks = collectSupplierRetailLeaks(payload)
  if (leaks.length === 0) return
  const detail = leaks.map((l) => l.path).join(", ")
  throw new Error(`[supplier-retail-veil] forbidden retail keys: ${detail}`)
}
