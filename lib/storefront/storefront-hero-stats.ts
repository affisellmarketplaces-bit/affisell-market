/**
 * What a storefront hero can truthfully say about the store — pure, no React, no network.
 *
 * Every figure comes from the products actually on sale: nothing is invented, a claim that is not true for THIS store is
 * simply not made (no "free shipping" chip when no product ships free, no Klarna chip below the checkout minimum).
 */
import { isKlarnaEligibleCents } from "@/lib/marketplace-checkout-payment-methods"
import { truncateText } from "@/lib/truncate-text"

export type HeroStats = {
  productCount: number
  /** Confirmed units sold by the best seller (0 when none) — only shown from a modest threshold. */
  topSales: number
  freeShippingCount: number
  /** At least one product reaches Klarna's checkout minimum, and Klarna is enabled. */
  klarnaEligible: boolean
}

type StatsProduct = {
  priceCents: number
  freeShipping?: boolean
  soldCount?: number
  sales?: { units?: number }
}

export function computeHeroStats(products: readonly StatsProduct[]): HeroStats {
  let topSales = 0
  let freeShippingCount = 0
  let klarnaEligible = false
  for (const p of products) {
    topSales = Math.max(topSales, p.sales?.units ?? 0, p.soldCount ?? 0)
    if (p.freeShipping) freeShippingCount += 1
    if (!klarnaEligible && isKlarnaEligibleCents(p.priceCents)) klarnaEligible = true
  }
  return { productCount: products.length, topSales, freeShippingCount, klarnaEligible }
}

/** A sales figure is social proof only when it is big enough to mean something. */
export const HERO_MIN_SALES_PROOF = 5

/** First sentence of the description, capped at `max` characters (emoji-safe), or null when there is nothing to say. */
export function heroTagline(description: string | null | undefined, max = 120): string | null {
  const text = (description ?? "").replace(/\s+/g, " ").trim()
  if (!text) return null
  const firstSentence = text.split(/(?<=[.!?…])\s+/)[0]!.trim()
  return truncateText(firstSentence, max)
}
