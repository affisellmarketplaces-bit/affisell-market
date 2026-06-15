import type { Prisma } from "@prisma/client"

import { prismaProductShipsFromEuWhere, prismaProductShipsWorldwideWhere } from "@/lib/eu-market-countries"
import type { MarketRegion } from "@/lib/market-config"
import { MARKET_REGION } from "@/lib/market-config"

/** Product filter: ships from the United States. */
export function prismaProductShipsFromUsWhere(): Prisma.ProductWhereInput {
  return {
    OR: [
      { shippingCountry: "US" },
      { shipsFrom: { equals: "US", mode: "insensitive" } },
      { shipsFrom: { contains: "United States", mode: "insensitive" } },
    ],
  }
}

/** Product filter: North America hub (US, CA, or regional warehouse). */
export function prismaProductShipsFromNorthAmericaWhere(): Prisma.ProductWhereInput {
  return {
    OR: [
      { shippingCountry: { in: ["US", "CA"] } },
      { warehouseType: "regional" },
      { shipsFrom: { equals: "NA", mode: "insensitive" } },
      { shipsFrom: { equals: "US", mode: "insensitive" } },
    ],
  }
}

/** URL `shipsFrom` facet → Prisma filter for the active market region. */
export function marketplaceShipsFromFilterWhere(
  shipsFrom: string,
  region: MarketRegion = MARKET_REGION
): Prisma.ProductWhereInput | null {
  if (region === "us") {
    if (shipsFrom === "us") return prismaProductShipsFromUsWhere()
    if (shipsFrom === "na") return prismaProductShipsFromNorthAmericaWhere()
    if (shipsFrom === "worldwide") return prismaProductShipsWorldwideWhere()
    return null
  }

  if (shipsFrom === "fr") return { shippingCountry: "FR" }
  if (shipsFrom === "eu") return prismaProductShipsFromEuWhere()
  if (shipsFrom === "worldwide") return prismaProductShipsWorldwideWhere()
  return null
}

/** Primary regional shipping facet for empty-state CTAs. */
export function primaryRegionalShipsFromFacet(region: MarketRegion = MARKET_REGION): "eu" | "na" {
  return region === "us" ? "na" : "eu"
}
