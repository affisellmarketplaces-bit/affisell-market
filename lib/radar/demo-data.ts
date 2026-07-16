import type { RadarConnectorProduct } from "@/lib/radar/connectors/types"

/** Demo bestsellers when Radar DB is unreachable. */
export const RADAR_DEMO_WINNERS: Array<{
  id: string
  title: string
  marketplaceId: string
  country: string
  price: number
  currency: string
  rank: number
  salesEst: number
  imageUrl: string | null
  url: string | null
  crawledAt: Date
}> = [
  {
    id: "demo-1",
    title: "LED Strip Lights RGB 5m",
    marketplaceId: "tiktok_shop",
    country: "US",
    price: 12.99,
    currency: "USD",
    rank: 1,
    salesEst: 42000,
    imageUrl: null,
    url: null,
    crawledAt: new Date(),
  },
  {
    id: "demo-2",
    title: "Shapewear High-Waist Seamless",
    marketplaceId: "amazon",
    country: "FR",
    price: 24.5,
    currency: "EUR",
    rank: 2,
    salesEst: 31000,
    imageUrl: null,
    url: null,
    crawledAt: new Date(),
  },
  {
    id: "demo-3",
    title: "MagSafe Phone Case Clear",
    marketplaceId: "tiktok_shop",
    country: "UK",
    price: 9.99,
    currency: "GBP",
    rank: 3,
    salesEst: 28000,
    imageUrl: null,
    url: null,
    crawledAt: new Date(),
  },
  {
    id: "demo-4",
    title: "Portable Blender USB-C",
    marketplaceId: "amazon",
    country: "DE",
    price: 29.9,
    currency: "EUR",
    rank: 4,
    salesEst: 19000,
    imageUrl: null,
    url: null,
    crawledAt: new Date(),
  },
  {
    id: "demo-5",
    title: "Neck Massager Heated",
    marketplaceId: "google_merchant",
    country: "US",
    price: 34.0,
    currency: "USD",
    rank: 5,
    salesEst: 15000,
    imageUrl: null,
    url: null,
    crawledAt: new Date(),
  },
]

export function demoAsConnectorProducts(): RadarConnectorProduct[] {
  return RADAR_DEMO_WINNERS.map((w) => ({
    id: w.id,
    title: w.title,
    price: w.price,
    currency: w.currency,
    marketplaceId: w.marketplaceId,
    url: w.url ?? undefined,
    imageUrl: w.imageUrl ?? undefined,
  }))
}
