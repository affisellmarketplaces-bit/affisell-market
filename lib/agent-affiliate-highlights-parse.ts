import type { AffiliateAgentProductCard } from "@/lib/agent-affiliate-product-card-types"

export type ParsedCatalogHighlights = {
  bestSellers: AffiliateAgentProductCard[]
  newArrivals: AffiliateAgentProductCard[]
  highMargin: AffiliateAgentProductCard[]
}

function highlightRowToCard(o: Record<string, unknown>): AffiliateAgentProductCard | null {
  const id = typeof o.id === "string" ? o.id : null
  const name = typeof o.name === "string" ? o.name : null
  if (!id || !name) return null

  const basePriceCents = typeof o.basePriceCents === "number" ? o.basePriceCents : 0
  const commissionRate = typeof o.commissionRate === "number" ? Math.round(o.commissionRate) : 0
  const marginCents =
    typeof o.marginCents === "number"
      ? o.marginCents
      : Math.max(0, Math.round((basePriceCents * commissionRate) / 100))

  return {
    id,
    name,
    imageUrl: typeof o.imageUrl === "string" ? o.imageUrl : null,
    description: "",
    supplierLabel: typeof o.supplierLabel === "string" ? o.supplierLabel : "Fournisseur",
    basePriceCents,
    commissionRate,
    marginCents,
    clientPriceCents: Math.round(basePriceCents * 1.3),
    usesListedPrice: false,
    isInStore: Boolean(o.isInStore),
    listingId: typeof o.listingId === "string" ? o.listingId : null,
  }
}

/** Parse getCatalogHighlights tool output (JSON string lines with h=0|1|2). */
export function parseCatalogHighlightsToolOutput(raw: unknown): ParsedCatalogHighlights | null {
  if (!Array.isArray(raw)) return null

  const out: ParsedCatalogHighlights = {
    bestSellers: [],
    newArrivals: [],
    highMargin: [],
  }

  for (const line of raw) {
    if (typeof line !== "string") continue
    try {
      const o = JSON.parse(line) as Record<string, unknown>
      const card = highlightRowToCard(o)
      if (!card) continue
      if (o.h === 0) out.bestSellers.push(card)
      else if (o.h === 1) out.newArrivals.push(card)
      else if (o.h === 2) out.highMargin.push(card)
    } catch {
      /* skip malformed line */
    }
  }

  if (out.bestSellers.length === 0 && out.newArrivals.length === 0 && out.highMargin.length === 0) {
    return null
  }

  return {
    bestSellers: out.bestSellers.slice(0, 5),
    newArrivals: out.newArrivals.slice(0, 5),
    highMargin: out.highMargin.slice(0, 5),
  }
}
