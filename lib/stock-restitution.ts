import type { StockScope } from "@/lib/checkout-stock"
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"

/**
 * Stock given back when a paid order is closed BEFORE anything left the warehouse (founder decision 7, part 1).
 *
 * In `CHECKOUT_STOCK_MODE=enforce` the fulfilment takes the units of a paid line from the stock
 * (`reserveStockInTransaction`). Nothing gave them back: every refund or cancellation of an order that never shipped
 * left the product under-stocked for good. Now:
 * - the fulfilment writes a RESERVATION MARKER in the same transaction as the decrement (an `AuditLog` row with the
 *   deterministic id `stock-reserved:<orderId>`: what was taken, from which product / variant row, how many — no
 *   migration), only when `enforce` really wrote the stock;
 * - the `restore-closed-order-stock` cron gives the units back for an order that is closed (refunded / cancelled, same
 *   rule as the payouts: `isOrderClosedForPayout`) AND provably never shipped nor bought from a supplier, then writes
 *   `stock-restored:<orderId>` in the same transaction — once, whatever the number of runs.
 *
 * NOT given back (under-selling, never overselling): an order that shipped or was bought from a supplier (a return is a
 * separate decision: is a returned item resellable?), a partially refunded order (it is not closed), a variant row that
 * no longer exists under the same name. In `warn` (the default) nothing is reserved, so nothing is restored.
 */
export const STOCK_RESERVED_ACTION = "stock.reserved"
export const STOCK_RESTORED_ACTION = "stock.restored"

export function stockReservedAuditId(orderId: string): string {
  return `stock-reserved:${orderId}`
}

export function stockRestoredAuditId(orderId: string): string {
  return `stock-restored:${orderId}`
}

export type StockReservationPayload = {
  productId: string
  qty: number
  scope: StockScope
  variantRowName: string | null
  stripeSessionId: string | null
}

export function buildStockReservedAuditRow(args: { orderId: string } & StockReservationPayload) {
  return {
    id: stockReservedAuditId(args.orderId),
    action: STOCK_RESERVED_ACTION,
    entityType: "Order",
    entityId: args.orderId,
    payload: {
      productId: args.productId,
      qty: args.qty,
      scope: args.scope,
      variantRowName: args.variantRowName,
      stripeSessionId: args.stripeSessionId,
    },
  }
}

/** Reads a marker payload back; `null` when it is not one we wrote (never guess a quantity). */
export function parseStockReservationPayload(raw: unknown): StockReservationPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const p = raw as Record<string, unknown>
  const qty = typeof p.qty === "number" && Number.isInteger(p.qty) && p.qty > 0 ? p.qty : null
  const scope = p.scope === "product" || p.scope === "variant" ? p.scope : null
  const productId = typeof p.productId === "string" && p.productId.trim() ? p.productId : null
  if (!qty || !scope || !productId) return null
  const variantRowName = typeof p.variantRowName === "string" && p.variantRowName.trim() ? p.variantRowName : null
  if (scope === "variant" && !variantRowName) return null
  return {
    productId,
    qty,
    scope,
    variantRowName,
    stripeSessionId: typeof p.stripeSessionId === "string" ? p.stripeSessionId : null,
  }
}

export type StockRestitutionOrderSnapshot = {
  status: string
  paymentSettlementStatus: string | null
  shippedAt: Date | string | null
  trackingNumber: string | null
  supplierOrderId: string | null
  fulfillmentStatus: string | null
}

/** Supplier-side states meaning the goods were (or may have been) bought or sent. */
const GOODS_MOVED_FULFILLMENT = new Set(["ORDERED", "SHIPPED", "DELIVERED", "PARTIAL"])

export type StockRestitutionEligibility =
  | { eligible: true }
  | { eligible: false; reason: "order_open" | "order_shipped" | "supplier_purchase_exists" }

export function evaluateStockRestitution(order: StockRestitutionOrderSnapshot): StockRestitutionEligibility {
  if (!isOrderClosedForPayout(order)) return { eligible: false, reason: "order_open" }
  if (order.shippedAt || order.trackingNumber?.trim()) return { eligible: false, reason: "order_shipped" }
  if (order.supplierOrderId?.trim()) return { eligible: false, reason: "supplier_purchase_exists" }
  if (GOODS_MOVED_FULFILLMENT.has((order.fulfillmentStatus ?? "").trim().toUpperCase())) {
    return { eligible: false, reason: "supplier_purchase_exists" }
  }
  return { eligible: true }
}
