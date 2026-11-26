/**
 * Delivery window of a product sheet — ONE rule for what the server stores (`parseSupplierProductShippingBody`) and
 * what the supplier's forms say will be stored (sheet check). Pure, client-safe.
 *
 * When a body does not carry a delivery time, the server stores DEFAULT_DELIVERY_MIN_DAYS–DEFAULT_DELIVERY_MAX_DAYS:
 * buyers then see a window the supplier never typed. `fromDefault` says so, so a form can tell the supplier.
 */
export const DEFAULT_DELIVERY_MIN_DAYS = 2
export const DEFAULT_DELIVERY_MAX_DAYS = 5

export function parseIntInRange(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

const typed = (raw: unknown) => raw != null && raw !== "" && Number.isFinite(Number(raw))

export type DeliveryWindow = { deliveryMin: number; deliveryMax: number; fromDefault: boolean }

export function parseDeliveryWindow(body: Record<string, unknown>): DeliveryWindow {
  const deliveryMin = parseIntInRange(body.deliveryMin, DEFAULT_DELIVERY_MIN_DAYS, 1, 60)
  const deliveryMax = parseIntInRange(body.deliveryMax, DEFAULT_DELIVERY_MAX_DAYS, 1, 90)
  return {
    deliveryMin: Math.min(deliveryMin, deliveryMax),
    deliveryMax: Math.max(deliveryMin, deliveryMax),
    fromDefault: !typed(body.deliveryMin) && !typed(body.deliveryMax),
  }
}
