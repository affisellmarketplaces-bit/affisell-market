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
  salesPerHour: number
  growth: number
  timestamp: string
  videoUrl?: string | null
  /** Deterministic 24h sparkline 0–1 for sidebar (no Math.random in UI). */
  sparkline: number[]
}

export const GLOBE_SUPPLIER_DEFAULT = { lat: 35, lng: 105 } as const

export const GLOBE_LIVE_MAX_EVENTS = 50
