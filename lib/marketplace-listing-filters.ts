import type { Prisma } from "@prisma/client"

import { EU_COUNTRIES } from "@/lib/supplier-product-shipping"

/** Build extra `Product` conditions from marketplace URL filters (AND with `active: true`). */
export function marketplaceProductFilterFromSearchParams(
  sp: Record<string, string | string[] | undefined>
): Prisma.ProductWhereInput | null {
  const shipsFrom = typeof sp.shipsFrom === "string" ? sp.shipsFrom : ""
  const delivery = typeof sp.delivery === "string" ? sp.delivery : ""
  const freeOnly = sp.freeShipping === "1" || sp.freeShipping === "true"

  const parts: Prisma.ProductWhereInput[] = []

  if (shipsFrom === "fr") {
    parts.push({ shippingCountry: "FR" })
  } else if (shipsFrom === "eu") {
    parts.push({
      OR: [
        { shippingCountry: { in: Array.from(EU_COUNTRIES) } },
        { warehouseType: "regional" },
      ],
    })
  } else if (shipsFrom === "worldwide") {
    parts.push({ warehouseType: "international" })
  }

  if (delivery === "under3") {
    parts.push({ deliveryMax: { lte: 3 } })
  } else if (delivery === "under7") {
    parts.push({ deliveryMax: { lte: 7 } })
  }

  if (freeOnly) {
    parts.push({ freeShippingThreshold: { not: null } })
    parts.push({ freeShippingThreshold: { gt: 0 } })
  }

  if (parts.length === 0) return null
  return parts.length === 1 ? parts[0]! : { AND: parts }
}

export function productWhereForMarketplace(
  sp: Record<string, string | string[] | undefined>
): Prisma.ProductWhereInput {
  const extra = marketplaceProductFilterFromSearchParams(sp)
  if (!extra) return { active: true }
  return { AND: [{ active: true }, extra] }
}
