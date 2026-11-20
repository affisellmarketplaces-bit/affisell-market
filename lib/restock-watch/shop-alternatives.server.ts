import "server-only"

import { prisma } from "@/lib/prisma"
import { loadReplacementProposal } from "@/lib/reseller-replacement/replace.server"
import { resolveListingVariant } from "@/lib/restock-watch/restock-watch.server"
import { readShopAlternativesMode, type ShopVariantAlternatives } from "@/lib/restock-watch/shop-alternatives"
import type { VariantChoice } from "@/lib/variant-selection"

/**
 * Read-only. The listing's OWN shop only (its reseller), the exact variant under the shared rule, shown only while that
 * variant is sold out, alternatives = live listings of the same shop offering that variant in stock.
 */
export async function loadShopVariantAlternatives(listingId: string, choice: VariantChoice): Promise<ShopVariantAlternatives> {
  if (readShopAlternativesMode() === "off") return { mode: "off" }
  const v = await resolveListingVariant(listingId, choice)
  if (!v.ok || !v.isListed) return { mode: "on", status: "variant_unresolved" }
  if (v.stock > 0) return { mode: "on", status: "not_sold_out" }
  const loaded = await loadReplacementProposal(v.affiliateId, listingId, { wantedVariantKey: v.key, inShopOnly: true })
  if (!loaded.ok || loaded.proposal.status !== "found") return { mode: "on", status: "none" }
  const alts = loaded.proposal.alternatives
  const listings = await prisma.affiliateProduct.findMany({
    where: { affiliateId: v.affiliateId, isListed: true, productId: { in: alts.map((a) => a.productId) } },
    select: { id: true, productId: true, customTitle: true },
  })
  const byProduct = new Map(listings.map((l) => [l.productId, l]))
  const items = alts.flatMap((a) => {
    const l = byProduct.get(a.productId)
    return l ? [{ listingId: l.id, name: (l.customTitle?.trim() || a.name).slice(0, 120), imageUrl: a.imageUrl, match: a.match }] : []
  })
  return items.length ? { mode: "on", status: "found", variantLabel: v.label, items } : { mode: "on", status: "none" }
}
