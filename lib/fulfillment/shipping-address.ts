import type { ShippingAddressPayload } from "@/lib/auto-order/types"

export function parseShipping(raw: unknown): ShippingAddressPayload {
  const o = (raw ?? {}) as Record<string, unknown>
  return {
    name: typeof o.name === "string" ? o.name : undefined,
    line1:
      typeof o.line1 === "string"
        ? o.line1
        : typeof o.line_1 === "string"
          ? o.line_1
          : undefined,
    line2: typeof o.line2 === "string" ? o.line2 : undefined,
    city: typeof o.city === "string" ? o.city : undefined,
    state: typeof o.state === "string" ? o.state : undefined,
    postal_code:
      typeof o.postal_code === "string"
        ? o.postal_code
        : typeof o.postalCode === "string"
          ? o.postalCode
          : undefined,
    country: typeof o.country === "string" ? o.country : undefined,
    phone: typeof o.phone === "string" ? o.phone : undefined,
  }
}
