import type { BubbleProductView } from "@/lib/social/bubble-product-types"

/** Client-safe viral captions — used by generator + fallback UI. */
export function buildViralCaptions(product: Pick<
  BubbleProductView,
  "title" | "salePrice" | "costPrice" | "marginEuro" | "bubbleUrl"
>) {
  const cost = product.costPrice?.toFixed(0) ?? "?"
  const sale = product.salePrice.toFixed(0)
  const title = product.title.slice(0, 60)
  return {
    moneyHook: `J'ai trouvé ce ${title} à ${cost}€ et je le revends ${sale}€ sans stock… Voilà comment 👇 ${product.bubbleUrl}`,
    problemHook: `Marre de chercher des produits rentables? Ce ${title} fait +${product.marginEuro.toFixed(0)}€ sans stock. ${product.bubbleUrl}`,
    trendHook: `POV: Tu découvres le produit que tout le monde va acheter en 2026 — ${title} · ${sale}€ ${product.bubbleUrl}`,
  }
}
