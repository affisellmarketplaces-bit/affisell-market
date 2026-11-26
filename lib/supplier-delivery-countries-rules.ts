/**
 * Pure delivery-country rules (no import): what a publication needs, shared by the server parser, the Express payload
 * builder and the commercial-readiness engine. `lib/supplier-delivery-countries.ts` re-exports them — it also holds
 * display helpers that import the translation picker, which client code must not pull in.
 */
/** Sentinel stored in `deliveryCountryCodes` — delivers to all platform checkout countries. */
export const DELIVERY_WORLDWIDE = "WORLDWIDE"

export const DELIVERY_COUNTRIES_REQUIRED_ERROR = "delivery_countries_required"

const ISO2_RE = /^[A-Z]{2}$/

export function normalizeDeliveryCountryCode(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase()
  if (trimmed === DELIVERY_WORLDWIDE) return DELIVERY_WORLDWIDE
  const code = trimmed.slice(0, 2)
  if (!ISO2_RE.test(code)) return null
  return code
}

export function parseDeliveryCountryCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out = new Set<string>()
  for (const item of raw) {
    if (typeof item !== "string") continue
    const code = normalizeDeliveryCountryCode(item)
    if (code) out.add(code)
  }
  if (out.has(DELIVERY_WORLDWIDE)) return [DELIVERY_WORLDWIDE]
  return [...out].sort()
}

export function validateDeliveryCountriesForPublish(codes: string[]): typeof DELIVERY_COUNTRIES_REQUIRED_ERROR | null {
  if (codes.length === 0) return DELIVERY_COUNTRIES_REQUIRED_ERROR
  return null
}

/** Warehouse zone a live listing must declare (`Product.warehouseType`). */
export const WAREHOUSE_TYPES: ReadonlySet<string> = new Set(["local", "regional", "international"])

export function parseWarehouseType(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : ""
  return WAREHOUSE_TYPES.has(v) ? v : null
}

export function validateWarehouseTypePublish(warehouseType: string | null): "warehouse_type_required" | null {
  if (!warehouseType || !WAREHOUSE_TYPES.has(warehouseType)) return "warehouse_type_required"
  return null
}
