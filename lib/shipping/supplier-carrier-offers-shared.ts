/**
 * Supplier carrier offers — resolves PDP badges from product config (client-safe).
 */
import {
  findCarrierById,
  getRecommended,
  type Carrier,
  type RecommendedCarriers,
} from "@/lib/shipping/carriers"

export type SupplierCarrierOfferSlot = "fastest" | "balanced" | "cheapest"

export type SupplierCarrierOffer = {
  slot: SupplierCarrierOfferSlot
  carrier: Carrier
  deliveryMin: number
  deliveryMax: number
}

export type ResolveSupplierCarrierOffersInput = {
  carrierIds: string[]
  buyerCountry: string
  shipFromCountry?: string | null
  deliveryMin: number
  deliveryMax: number
  shippingMethods?: string[]
}

const slotCarriers = (
  ranked: RecommendedCarriers
): Record<SupplierCarrierOfferSlot, Carrier | null> => ({
  fastest: ranked.fastest,
  balanced: ranked.balanced,
  cheapest: ranked.cheapest,
})

export function parseShippingCarrierIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== "string") continue
    const id = item.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= 8) break
  }
  return out
}

export function carrierServesBuyerCountry(carrier: Carrier, buyerCountry: string): boolean {
  const cc = buyerCountry.trim().toUpperCase()
  if (!cc) return true
  return carrier.country.includes(cc) || carrier.country.includes("EU") || carrier.country.includes("WORLD")
}

/** Smart defaults when supplier has not picked carriers yet (legacy listings). */
export function suggestCarrierIdsForProduct(input: {
  shipFromCountry: string | null
  shippingMethods: string[]
  buyerCountry?: string
}): string[] {
  const cc = (input.shipFromCountry ?? input.buyerCountry ?? "FR").trim().toUpperCase() || "FR"
  const rec = getRecommended(cc)
  const ids: string[] = []
  const methods = input.shippingMethods.length > 0 ? input.shippingMethods : ["standard"]

  if (methods.includes("express") && rec.fastest) ids.push(rec.fastest.id)
  if (rec.balanced) ids.push(rec.balanced.id)
  if (
    (methods.includes("standard") || methods.includes("pickup") || methods.includes("economy")) &&
    rec.cheapest
  ) {
    ids.push(rec.cheapest.id)
  }

  return [...new Set(ids)].slice(0, 5)
}

function poolFromIds(ids: string[], buyerCountry: string): Carrier[] {
  return ids
    .map((id) => findCarrierById(id))
    .filter((c): c is Carrier => c !== null)
    .filter((c) => carrierServesBuyerCountry(c, buyerCountry))
}

function balancedScore(c: Carrier): number {
  return c.reliability * 2 - c.delivery_max
}

function rankPool(pool: Carrier[]): RecommendedCarriers {
  const express = pool.filter((c) => c.type === "express")
  const fastest =
    [...express].sort(
      (a, b) =>
        a.delivery_max - b.delivery_max ||
        a.delivery_min - b.delivery_min ||
        b.reliability - a.reliability
    )[0] ?? null

  const cheapPool = pool.filter(
    (c) => (c.type === "economy" || c.type === "pickup") && c.reliability >= 80
  )
  const cheapest =
    [...cheapPool].sort(
      (a, b) =>
        b.delivery_max - a.delivery_max ||
        a.reliability - b.reliability ||
        (a.type === "economy" ? -1 : 1) - (b.type === "economy" ? -1 : 1)
    )[0] ?? null

  const balanced =
    [...pool].sort((a, b) => balancedScore(b) - balancedScore(a) || b.reliability - a.reliability)[0] ??
    null

  return { fastest, cheapest, balanced, all: pool }
}

function displayDeliveryWindow(
  carrier: Carrier,
  productMin: number,
  productMax: number
): { deliveryMin: number; deliveryMax: number } {
  const min = Math.max(1, Math.min(productMin, carrier.delivery_min))
  const max = Math.max(min, Math.min(productMax, carrier.delivery_max))
  return { deliveryMin: min, deliveryMax: max }
}

/**
 * Build up to 3 PDP offer slots from supplier-configured carrier ids.
 * Falls back to suggested catalog picks for legacy products without config.
 */
export function resolveSupplierCarrierOffers(
  input: ResolveSupplierCarrierOffersInput
): SupplierCarrierOffer[] {
  const buyer = input.buyerCountry.trim().toUpperCase() || "FR"
  let pool = poolFromIds(input.carrierIds, buyer)

  if (pool.length === 0) {
    const suggested = suggestCarrierIdsForProduct({
      shipFromCountry: input.shipFromCountry ?? null,
      shippingMethods: input.shippingMethods ?? ["standard"],
      buyerCountry: buyer,
    })
    pool = poolFromIds(suggested, buyer)
  }

  if (pool.length === 0) return []

  const ranked = rankPool(pool)
  const bySlot = slotCarriers(ranked)
  const slots: SupplierCarrierOfferSlot[] = ["fastest", "balanced", "cheapest"]
  const used = new Set<string>()
  const offers: SupplierCarrierOffer[] = []

  for (const slot of slots) {
    const carrier = bySlot[slot]
    if (!carrier || used.has(carrier.id)) continue
    used.add(carrier.id)
    const window = displayDeliveryWindow(carrier, input.deliveryMin, input.deliveryMax)
    offers.push({ slot, carrier, ...window })
  }

  return offers
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

export function carriersForShipFromCountry(shipFromCountry: string | null): Carrier[] {
  const cc = shipFromCountry?.trim().toUpperCase() || "FR"
  const rec = getRecommended(cc)
  const ids = new Set<string>()
  for (const c of [rec.fastest, rec.balanced, rec.cheapest, ...rec.all.slice(0, 12)]) {
    if (c) ids.add(c.id)
  }
  return [...ids]
    .map((id) => findCarrierById(id))
    .filter((c): c is Carrier => c !== null)
    .sort((a, b) => b.reliability - a.reliability || a.name.localeCompare(b.name))
}
