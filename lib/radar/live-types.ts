/**
 * Trust Radar 3D Globe — shared LiveEvent shape (client + server).
 * Real orders/imports fill this; demo synthesizer uses the same type.
 */

export type LiveEventType = "sale" | "import" | "spike"

export type LiveEventLocation = {
  country: string
  city: string
  lat: number
  lng: number
}

export type LiveEventProduct = {
  id: string
  title: string
  image: string | null
  price: number
  category: string
  /** Supplier / AliExpress URL for DropForge prefill via /import?url= */
  supplierUrl?: string | null
  affiliateProductId?: string | null
}

export type LiveEvent = {
  id: string
  type: LiveEventType
  product: LiveEventProduct
  location: LiveEventLocation
  supplierLocation: { lat: number; lng: number }
  /**
   * MEASURED sales per hour: only a real sales spike has one (the count of orders of that product in the last hour). `null` for a
   * single sale or an import (a sale used to claim a constant 1/h, an import 0). Generated (synthetic) events carry a made-up number.
   */
  salesPerHour: number | null
  /**
   * Growth %: `null` for every real event — it used to be a hash of the order / product id ("+137 %"), i.e. a fabricated
   * metric next to real sale data. Only a generated (synthetic) demo event carries one, and it is labelled as a demo.
   */
  growth: number | null
  timestamp: string
  videoUrl?: string | null
  /** 24 h curve 0–1: `null` for every real event (it was a pure function of the event id). Only synthetic events carry one. */
  sparkline: number[] | null
  /**
   * True when the whole event was generated to fill the globe (no order, import or sales spike stands behind it). Never a
   * result: the UI labels it as a demo. Absent/false = it comes from a real order, import or measured spike.
   */
  synthetic?: boolean
  /**
   * `order`: the country comes from the order's real shipping address. `estimated`: the city/country was picked by a hash of
   * the product id (imports and spikes carry no location) — the pin is NOT where anything happened.
   */
  locationSource?: "order" | "estimated"
}

/** Provenance of a set of live events (same vocabulary as the World Radar payload). */
export type LiveEventsSource = "live" | "mixed" | "demo"

/** `demo` when every event is synthetic, `live` when none is, `mixed` otherwise. An empty list is `demo` (nothing real). */
export function classifyLiveEventsSource(events: ReadonlyArray<{ synthetic?: boolean }>): LiveEventsSource {
  const synthetic = events.filter((e) => e.synthetic === true).length
  if (events.length === 0 || synthetic === events.length) return "demo"
  return synthetic === 0 ? "live" : "mixed"
}

export const GLOBE_SUPPLIER_DEFAULT = { lat: 35, lng: 105 } as const

export const GLOBE_LIVE_MAX_EVENTS = 50
