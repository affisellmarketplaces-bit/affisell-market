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
export const GHOST_LOW_STOCK_THRESHOLD = 5
export const GHOST_PRICE_DRIFT_RATIO = 0.15
export const GHOST_STOCK15_COUPON = "STOCK15"
export const GHOST_FAILS_BEFORE_DRAFT = 3
