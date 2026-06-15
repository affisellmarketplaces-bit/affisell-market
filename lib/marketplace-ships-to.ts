import type { Prisma } from "@prisma/client"

import {
  isEuMemberCountry,
  prismaProductShipsFromEuWhere,
  prismaProductShipsWorldwideWhere,
} from "@/lib/eu-market-countries"
import {
  prismaProductShipsFromNorthAmericaWhere,
  prismaProductShipsFromUsWhere,
} from "@/lib/market-region-shipping"
import type { MarketRegion } from "@/lib/market-config"
import { MARKET_REGION } from "@/lib/market-config"
import { normalizeVisitorCountryIso2 } from "@/lib/visitor-country"

function flattenOr(where: Prisma.ProductWhereInput): Prisma.ProductWhereInput[] {
  const or = where.OR
  return Array.isArray(or) ? or : [where]
}

/** Products that can realistically ship to a buyer country (ROW rollout filter). */
export function prismaProductShipsToCountryWhere(
  countryIso2: string,
  region: MarketRegion = MARKET_REGION
): Prisma.ProductWhereInput {
  const code = countryIso2.toUpperCase()
  const parts: Prisma.ProductWhereInput[] = [
    ...flattenOr(prismaProductShipsWorldwideWhere()),
    { shippingCountry: code },
  ]

  if (region === "eu" && isEuMemberCountry(code)) {
    parts.push(...flattenOr(prismaProductShipsFromEuWhere()))
  }
  if (region === "us") {
    if (code === "US") parts.push(...flattenOr(prismaProductShipsFromUsWhere()))
    if (code === "US" || code === "CA") {
      parts.push(...flattenOr(prismaProductShipsFromNorthAmericaWhere()))
    }
  }

  return { OR: parts }
}

export function marketplaceShipsToFilterWhere(
  shipsTo: string,
  region: MarketRegion = MARKET_REGION
): Prisma.ProductWhereInput | null {
  const code = normalizeVisitorCountryIso2(shipsTo)
  if (!code) return null
  return prismaProductShipsToCountryWhere(code, region)
}
