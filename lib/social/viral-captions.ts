import type { BubbleProductView } from "@/lib/social/bubble-product-types"

/**
 * Client-safe viral captions — product + sale price + marketing hook only.
 * Never includes cost, margin, or "je gagne X€".
 */
export function buildViralCaptions(
  product: Pick<BubbleProductView, "title" | "salePrice" | "bubbleUrl">
) {
  const sale = product.salePrice.toFixed(0)
  const title = product.title.slice(0, 60)
  return {
    moneyHook: `${title} — ${sale}€ · Livraison 24/48h · Lien en bio 👇 ${product.bubbleUrl}`,
    problemHook: `Encore en train de scroller? ${title} — ${sale}€ · Stock local · Livraison rapide ${product.bubbleUrl}`,
    trendHook: `POV: Le produit que tout le monde va acheter en 2026 — ${title} · ${sale}€ · Livraison 24h ${product.bubbleUrl}`,
  }
}

/** Patterns that must never appear in client-facing social copy / PNG hooks. */
const MARGIN_LEAK_RE =
  /bénéfice|benefice|\bprofit\b|\bmarge\b|\+\s*\d+[.,]?\d*\s*€|revend[se]?\b|coût\s*produit|cout\s*produit|cost\s*price|Live Profit|sans\s*stock/i

export function isClientSafeSocialText(text: string): boolean {
  return !MARGIN_LEAK_RE.test(text)
}
