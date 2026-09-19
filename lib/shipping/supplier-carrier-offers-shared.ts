/**
 * Supplier shipping offers (client-safe).
 *
 * RULE: a carrier is shown to a buyer ONLY if the supplier defined it in their shop shipping profile.
 * There is no fallback, no suggestion and no Affisell-invented metric (reliability %, "cheapest", …):
 * everything the buyer sees — carrier, delivery window — comes from the supplier.
 */
import { CARRIERS, findCarrierById, type Carrier } from "@/lib/shipping/carriers"
import { isEuropeanCountry } from "@/lib/shipping/carriers-europe"

/** One carrier the supplier offers, with the delivery window THEY commit to. */
export type ShopShippingOffer = {
  carrierId: string
  deliveryMin: number
  deliveryMax: number
  /** Destination ISO2 codes this carrier serves for the shop. Empty = every destination the product ships to. */
  countries?: string[]
}

export const MAX_SHOP_SHIPPING_OFFERS = 40
export const MAX_PRODUCT_CARRIER_IDS = 40
const MAX_DELIVERY_DAYS = 90

const CARRIER_IDS: ReadonlySet<string> = new Set(CARRIERS.map((c) => c.id))

const clampDays = (n: unknown, fallback: number): number => {
  const v = Math.round(Number(n))
  return Number.isFinite(v) ? Math.min(MAX_DELIVERY_DAYS, Math.max(1, v)) : fallback
}

/** Product-level selection: ids of carriers (from the catalog) the supplier keeps for this SKU. */
export function parseShippingCarrierIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== "string") continue
    const id = item.trim()
    if (!id || seen.has(id) || !CARRIER_IDS.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= MAX_PRODUCT_CARRIER_IDS) break
  }
  return out
}

/** Validates the shop profile payload: known carriers only, sane windows, unique, capped. */
export function parseShopShippingOffers(raw: unknown): ShopShippingOffer[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: ShopShippingOffer[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const carrierId = typeof o.carrierId === "string" ? o.carrierId.trim() : ""
    if (!carrierId || seen.has(carrierId) || !CARRIER_IDS.has(carrierId)) continue
    const min = clampDays(o.deliveryMin, 2)
    const max = clampDays(o.deliveryMax, Math.max(min, 5))
    const countries = Array.isArray(o.countries)
      ? [...new Set(o.countries.filter((c): c is string => typeof c === "string").map((c) => c.trim().toUpperCase()))]
          .filter((c) => /^[A-Z]{2}$/.test(c))
          .slice(0, 80)
      : []
    seen.add(carrierId)
    out.push({
      carrierId,
      deliveryMin: Math.min(min, max),
      deliveryMax: Math.max(min, max),
      ...(countries.length > 0 ? { countries } : {}),
    })
    if (out.length >= MAX_SHOP_SHIPPING_OFFERS) break
  }
  return out
}

/** What the PDP shows for one carrier. */
export type PdpShippingOffer = {
  carrier: Carrier
  deliveryMin: number
  deliveryMax: number
  /** True only when at least 2 offers exist and this one is strictly the fastest of the supplier's own windows. */
  fastest: boolean
}

export type ResolvePdpShippingInput = {
  /** The supplier's shop shipping profile. Empty → nothing is shown. */
  shopOffers: readonly ShopShippingOffer[]
  /** Product-level subset (optional). Ignored if it matches none of the shop's offers. */
  productCarrierIds?: readonly string[]
  buyerCountry: string
}

const MAX_PDP_OFFERS = 6

export function resolvePdpShippingOffers(input: ResolvePdpShippingInput): PdpShippingOffer[] {
  if (input.shopOffers.length === 0) return []

  const subset = new Set((input.productCarrierIds ?? []).filter(Boolean))
  const scoped = subset.size > 0 ? input.shopOffers.filter((o) => subset.has(o.carrierId)) : []
  const pool = scoped.length > 0 ? scoped : input.shopOffers

  const buyer = input.buyerCountry.trim().toUpperCase()
  const rows: Omit<PdpShippingOffer, "fastest">[] = []
  for (const offer of pool) {
    const carrier = findCarrierById(offer.carrierId)
    if (!carrier) continue
    if (offer.countries && offer.countries.length > 0 && buyer && !offer.countries.includes(buyer)) continue
    rows.push({ carrier, deliveryMin: offer.deliveryMin, deliveryMax: offer.deliveryMax })
  }

  rows.sort(
    (a, b) =>
      a.deliveryMax - b.deliveryMax || a.deliveryMin - b.deliveryMin || a.carrier.name.localeCompare(b.carrier.name)
  )
  const top = rows.slice(0, MAX_PDP_OFFERS)
  const first = top[0]
  const second = top[1]
  const uniqueFastest =
    top.length >= 2 &&
    first !== undefined &&
    second !== undefined &&
    (first.deliveryMax < second.deliveryMax || (first.deliveryMax === second.deliveryMax && first.deliveryMin < second.deliveryMin))

  return top.map((row, i) => ({ ...row, fastest: uniqueFastest && i === 0 }))
}

export function shippingMethodsFromCarrierIds(ids: string[]): string[] {
  const methods = new Set<string>(["standard"])
  for (const id of ids) {
    const c = findCarrierById(id)
    if (!c) continue
    if (c.type === "express") methods.add("express")
    if (c.type === "pickup") methods.add("pickup")
  }
  return [...methods]
}

/** Carriers the supplier can add for a destination scope (used by the shop shipping editor). */
export function catalogForCountries(codes: readonly string[]): Carrier[] {
  const wanted = new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))
  if (wanted.size === 0) return [...CARRIERS]
  return CARRIERS.filter(
    (c) =>
      c.country.some((cc) => wanted.has(cc)) ||
      c.country.includes("WORLD") ||
      (c.country.includes("EUROPE") && [...wanted].some((w) => isEuropeanCountry(w)))
  )
}
