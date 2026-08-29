/** Ghost Checkout — shared stock result types. */

export type GhostStockStatus = "in_stock" | "out_of_stock" | "low_stock" | "unknown"

export type StockResult = {
  status: Exclude<GhostStockStatus, "unknown"> | "unknown"
  /** Current supplier price in EUR (best effort). */
  price: number
  estimatedDeliveryDays?: number
  checkedAt: Date
  source: string
}

export type GhostSupplierSource = "aliexpress" | "temu" | "amazon"

export const GHOST_CHECK_TIMEOUT_MS = 3_000
/** Checkout probe — fail fast to Stripe; fallback in_stock on timeout. */
export const GHOST_CHECKOUT_PROBE_TIMEOUT_MS = 1_500
/** Trust recent in_stock / low_stock checks during checkout (skip live scrape). */
export const GHOST_CHECKOUT_CACHE_MS = 8 * 60 * 1000
/** Re-verify OOS quickly — shorter cache window. */
export const GHOST_CHECKOUT_OOS_CACHE_MS = 90 * 1000
export const GHOST_LOW_STOCK_THRESHOLD = 5
export const GHOST_PRICE_DRIFT_RATIO = 0.15
export const GHOST_STOCK15_COUPON = "STOCK15"
export const GHOST_FAILS_BEFORE_DRAFT = 3
