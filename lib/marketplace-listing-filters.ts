import type { Prisma } from "@prisma/client"

import { AFFISELL_CATEGORIES } from "@/lib/affisell-categories"
import { marketplaceShipsFromFilterWhere } from "@/lib/market-region-shipping"
import { parseOfferFacetValue } from "@/lib/product-offer-mode"

const AFFISELL_CATEGORY_SET = new Set<string>(AFFISELL_CATEGORIES as readonly string[])

/** Build extra `Product` conditions from marketplace URL filters (AND with `active: true`). */
export function marketplaceProductFilterFromSearchParams(
  sp: Record<string, string | string[] | undefined>
): Prisma.ProductWhereInput | null {
  const shipsFrom = typeof sp.shipsFrom === "string" ? sp.shipsFrom : ""
  const delivery = typeof sp.delivery === "string" ? sp.delivery : ""
  const freeOnly = sp.freeShipping === "1" || sp.freeShipping === "true"
  const categoryRaw = typeof sp.category === "string" ? sp.category.trim() : ""
  const offerRaw = typeof sp.offer === "string" ? sp.offer : ""

  const parts: Prisma.ProductWhereInput[] = []

  if (
    categoryRaw &&
    categoryRaw !== "All Departments" &&
    AFFISELL_CATEGORY_SET.has(categoryRaw)
  ) {
    parts.push({ categories: { has: categoryRaw } })
  }

  if (shipsFrom) {
    const shipsWhere = marketplaceShipsFromFilterWhere(shipsFrom)
    if (shipsWhere) parts.push(shipsWhere)
  }

  if (delivery === "under3") {
    parts.push({ deliveryMax: { lte: 3 } })
  } else if (delivery === "under7") {
    parts.push({ deliveryMax: { lte: 7 } })
  }

  if (freeOnly) {
    parts.push({
      OR: [
        { AND: [{ freeShippingThreshold: { not: null } }, { freeShippingThreshold: { gt: 0 } }] },
        { freeShipping: true },
      ],
    })
  }

  const offerMode = offerRaw ? parseOfferFacetValue(offerRaw) : null
  if (offerMode) {
    parts.push({ offerMode })
  }

  if (parts.length === 0) return null
  return parts.length === 1 ? parts[0]! : { AND: parts }
}

export function productWhereForMarketplace(
  sp: Record<string, string | string[] | undefined>
): Prisma.ProductWhereInput {
  const extra = marketplaceProductFilterFromSearchParams(sp)
  const qRaw = typeof sp.q === "string" ? sp.q.trim() : ""
  const qFilter: Prisma.ProductWhereInput | undefined =
    qRaw.length > 0 ? { name: { contains: qRaw, mode: "insensitive" } } : undefined

  const parts: Prisma.ProductWhereInput[] = [{ active: true }]
  if (qFilter) parts.push(qFilter)
  if (extra) parts.push(extra)
  if (parts.length === 1) return parts[0]!
  return { AND: parts }
}
