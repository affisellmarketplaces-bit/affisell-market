import "server-only"

import type { HomeProductCard } from "@/lib/home-marketplace-cards"
import { BUYER_BESTSELLERS_PATH } from "@/lib/buyer-bestsellers-route"
import { loadHomeBestSellers7dSafe } from "@/lib/public-home-data"

import type { DonaProductHit } from "@/lib/dona/dona-product-types"

export function homeCardToDonaHit(card: HomeProductCard, rank: number): DonaProductHit {
  return {
    listingId: card.listingId,
    productId: card.productId,
    name: card.name,
    price: card.priceCents / 100,
    imageUrl: card.imageUrl,
    brand: card.storeName,
    url: `/marketplace/${card.listingId}`,
    rank,
    soldCount: card.soldCount,
  }
}

export function encodeDonaBestsellerRow(p: DonaProductHit): string {
  return JSON.stringify({
    g: 0,
    listingId: p.listingId,
    productId: p.productId,
    name: p.name,
    price: p.price,
    imageUrl: p.imageUrl,
    brand: p.brand,
    url: p.url,
    rank: p.rank,
    soldCount: p.soldCount,
    src: "bestsellers",
  })
}

export async function loadDonaBestsellerHits(limit = 3): Promise<DonaProductHit[]> {
  const capped = Math.min(Math.max(limit, 1), 5)
  const rows = await loadHomeBestSellers7dSafe(capped)
  return rows.map((row, index) => homeCardToDonaHit(row, index + 1))
}

export async function buildDonaBestsellerToolOutput(limit = 3): Promise<string[]> {
  const hits = await loadDonaBestsellerHits(limit)
  const lines: string[] = [
    JSON.stringify({
      t: "hub",
      url: BUYER_BESTSELLERS_PATH,
      window: "7d",
    }),
  ]
  for (const hit of hits) {
    lines.push(encodeDonaBestsellerRow(hit))
  }
  return lines
}
