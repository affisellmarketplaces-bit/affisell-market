/**
 * How a supplier DECLARES what it can sell (founder decision 2026-11-19).
 *
 * Rule: a product is never published with an invented price or quantity (the
 * guided Express wizard used to send price 10 € and stock 99 when the supplier
 * had typed nothing). An unknown value is never shown as a real one.
 *
 * Availability modes — only what the platform really supports is selectable:
 *
 * | mode           | supported | why                                                         |
 * |----------------|-----------|-------------------------------------------------------------|
 * | `quantity`     | yes       | `Product.stock` (or the SKU rows' stock): checkout, PDP and |
 * |                |           | the stock gate read it.                                      |
 * | `not_stocked`  | yes       | non-physical listing kinds (service, software, subscription,|
 * |                |           | experience): no physical stock is asked for.                 |
 * | `made_to_order`| NO        | no field, the PDP shows « sold out » at 0, no lead time per |
 * |                |           | unit, the stock gate would refuse at 0.                      |
 * | `always_available` | NO    | same: a fake large quantity would be exactly the « 99 » this |
 * |                |           | decision forbids.                                            |
 * | `preorder`     | NO        | no release date, no deferred-shipment rule at checkout.      |
 *
 * The three unsupported modes are listed so the UI and the docs can say so; a
 * supplier who works that way is told what is missing instead of being forced to
 * invent a quantity. Supporting one = a storage decision + checkout / PDP / stock
 * gate changes (founder decision, `docs/INNOVATION-CYCLE-2026-11.md`).
 *
 * Pure and client-safe.
 */

export const AVAILABILITY_MODES = [
  { id: "quantity", supported: true },
  { id: "not_stocked", supported: true },
  { id: "made_to_order", supported: false },
  { id: "always_available", supported: false },
  { id: "preorder", supported: false },
] as const

export type AvailabilityModeId = (typeof AVAILABILITY_MODES)[number]["id"]

/** Listing kinds that carry no physical stock (see `Product.listingKind`). */
const NON_PHYSICAL_KINDS = new Set(["SOFTWARE", "SUBSCRIPTION", "SERVICE", "EXPERIENCE"])

export function listingKindNeedsStock(listingKind: string | null | undefined): boolean {
  const k = (listingKind ?? "PHYSICAL").trim().toUpperCase()
  return !NON_PHYSICAL_KINDS.has(k)
}

export function availabilityModeFor(listingKind: string | null | undefined): AvailabilityModeId {
  return listingKindNeedsStock(listingKind) ? "quantity" : "not_stocked"
}

export const MAX_DECLARED_STOCK = 1_000_000

/**
 * A quantity the supplier really typed: a whole number 0 … 1 000 000.
 * Empty / blank / decimal / negative / not a number = null ("not declared").
 */
export function parseDeclaredQuantity(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isInteger(input) && input >= 0 && input <= MAX_DECLARED_STOCK ? input : null
  }
  if (typeof input !== "string") return null
  const s = input.trim()
  if (!/^\d{1,7}$/.test(s)) return null
  const n = Number(s)
  return n <= MAX_DECLARED_STOCK ? n : null
}

/** A price the supplier really typed, in euros (> 0, at most 2 decimals, ≤ 1 000 000). */
export function parseDeclaredPriceEur(input: unknown): number | null {
  const n = typeof input === "number" ? input : typeof input === "string" && input.trim() ? Number(input.trim().replace(",", ".")) : NaN
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null
  return Math.round(n * 100) / 100
}

export type PublishDeclarationError =
  | "price_required"
  | "stock_required"
  | "stock_zero"
  | "variant_stock_required"

export type PublishDeclaration =
  | { ok: true; priceEur: number; stock: number | null; mode: AvailabilityModeId }
  | { ok: false; errors: PublishDeclarationError[] }

/**
 * What a PUBLICATION needs from the supplier: a real price, and — for a physical
 * product — a declared quantity (> 0: publishing something with nothing to sell
 * would only show « sold out »). With SKU rows, every row needs its own declared
 * quantity and the total must be > 0. A non-physical listing needs no stock.
 */
export function validatePublishDeclaration(args: {
  listingKind?: string | null
  price: unknown
  stock: unknown
  variantStocks?: unknown[] | null
}): PublishDeclaration {
  const errors: PublishDeclarationError[] = []
  const priceEur = parseDeclaredPriceEur(args.price)
  if (priceEur == null) errors.push("price_required")

  const mode = availabilityModeFor(args.listingKind)
  let stock: number | null = null
  if (mode === "quantity") {
    if (Array.isArray(args.variantStocks) && args.variantStocks.length > 0) {
      const parsed = args.variantStocks.map(parseDeclaredQuantity)
      if (parsed.some((q) => q == null)) errors.push("variant_stock_required")
      else {
        stock = (parsed as number[]).reduce((a, b) => a + b, 0)
        if (stock === 0) errors.push("stock_zero")
      }
    } else {
      stock = parseDeclaredQuantity(args.stock)
      if (stock == null) errors.push("stock_required")
      else if (stock === 0) errors.push("stock_zero")
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, priceEur: priceEur as number, stock, mode }
}
