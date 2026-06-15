import type { Prisma } from "@prisma/client"

import type { AppLocale } from "@/lib/i18n-locale"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import {
  MARKETPLACE_DELIVERY_FACET_KEY,
  MARKETPLACE_DEPT_FACET_KEY,
  MARKETPLACE_FREE_SHIP_FACET_KEY,
  MARKETPLACE_OFFER_FACET_KEY,
  MARKETPLACE_PRICE_FACET_KEY,
  MARKETPLACE_SHIPS_FACET_KEY,
  parseDeptFacetValue,
} from "@/lib/marketplace-discovery-facets-shared"
import { offerFacetSlug, offerModeFilterLabel } from "@/lib/product-offer-mode"
import type { ProductOfferMode } from "@/lib/product-offer-mode"
import { loadMarketplaceCategoryTreeCached } from "@/lib/marketplace-category-tree"
import type { MarketplaceFacet } from "@/lib/marketplace-facet-types"
import { MARKET_REGION } from "@/lib/market-config"
import { EU_MEMBER_COUNT, prismaProductShipsFromEuWhere, prismaProductShipsWorldwideWhere } from "@/lib/eu-market-countries"
import {
  prismaProductShipsFromNorthAmericaWhere,
  prismaProductShipsFromUsWhere,
} from "@/lib/market-region-shipping"
import { prisma, withPrismaReconnect } from "@/lib/prisma"

export { DISCOVERY_FACET_KEYS, parseDeptFacetValue } from "@/lib/marketplace-discovery-facets-shared"

const PRICE_FACET_KEY = MARKETPLACE_PRICE_FACET_KEY
const SHIPS_FACET_KEY = MARKETPLACE_SHIPS_FACET_KEY
const DELIVERY_FACET_KEY = MARKETPLACE_DELIVERY_FACET_KEY
const FREE_SHIP_FACET_KEY = MARKETPLACE_FREE_SHIP_FACET_KEY
const DEPT_FACET_KEY = MARKETPLACE_DEPT_FACET_KEY
const OFFER_FACET_KEY = MARKETPLACE_OFFER_FACET_KEY

const OFFER_FACET_MODES: ProductOfferMode[] = [
  "STANDARD",
  "REFURBISHED",
  "SECOND_HAND",
  "WHOLESALE_ONLY",
  "DONATION",
]

type Labels = { fr: Record<string, string>; en: Record<string, string> }

const FACET_LABELS: Labels = {
  fr: {
    [PRICE_FACET_KEY]: "Prix",
    [SHIPS_FACET_KEY]: "Expédition depuis",
    [DELIVERY_FACET_KEY]: "Délai de livraison",
    [FREE_SHIP_FACET_KEY]: "Livraison",
    [DEPT_FACET_KEY]: "Rayons",
    [OFFER_FACET_KEY]: "Type d'offre",
  },
  en: {
    [PRICE_FACET_KEY]: "Price",
    [SHIPS_FACET_KEY]: "Ships from",
    [DELIVERY_FACET_KEY]: "Delivery time",
    [FREE_SHIP_FACET_KEY]: "Shipping",
    [DEPT_FACET_KEY]: "Departments",
    [OFFER_FACET_KEY]: "Offer type",
  },
}

function facetLabel(key: string, locale: AppLocale): string {
  return (locale === "en" ? FACET_LABELS.en : FACET_LABELS.fr)[key] ?? key
}

async function countListingsForProductWhere(
  productExtra: Prisma.ProductWhereInput
): Promise<number> {
  return withPrismaReconnect(() =>
    prisma.affiliateProduct.count({
      where: {
        ...buyerListedAffiliateProductWhere,
        affiliate: { store: { isNot: null } },
        product: productExtra,
      },
    })
  )
}

/** Global discovery facets (no category scope) — Amazon-style left rail. */
export async function loadGlobalMarketplaceDiscoveryFacets(
  locale: AppLocale
): Promise<MarketplaceFacet[]> {
  const tree = await loadMarketplaceCategoryTreeCached(locale)
  const departments: MarketplaceFacet["values"] = tree.categories
    .filter((c) => c.count > 0)
    .slice(0, 14)
    .map((c) => ({
      value: c.id,
      count: c.count,
    }))

  const listingCount = (extra: Prisma.AffiliateProductWhereInput) =>
    withPrismaReconnect(() =>
      prisma.affiliateProduct.count({
        where: {
          ...buyerListedAffiliateProductWhere,
          affiliate: { store: { isNot: null } },
          ...extra,
        },
      })
    )

  const offerCountsPromise = Promise.all(
    OFFER_FACET_MODES.map((mode) =>
      countListingsForProductWhere({ offerMode: mode }).then((count) => ({ mode, count }))
    )
  )

  const isUsMarket = MARKET_REGION === "us"
  const currencySym = isUsMarket ? "$" : "€"

  const [under25, mid, over100, shipFacetCounts, under3, under7, freeShip, offerCounts] =
    await Promise.all([
    listingCount({ sellingPriceCents: { lte: 2500 } }),
    listingCount({ sellingPriceCents: { gt: 2500, lte: 10000 } }),
    listingCount({ sellingPriceCents: { gt: 10000 } }),
    isUsMarket
      ? Promise.all([
          countListingsForProductWhere(prismaProductShipsFromUsWhere()),
          countListingsForProductWhere(prismaProductShipsFromNorthAmericaWhere()),
          countListingsForProductWhere(prismaProductShipsWorldwideWhere()),
        ])
      : Promise.all([
          countListingsForProductWhere({ shippingCountry: "FR" }),
          countListingsForProductWhere(prismaProductShipsFromEuWhere()),
          countListingsForProductWhere(prismaProductShipsWorldwideWhere()),
        ]),
    countListingsForProductWhere({ deliveryMax: { lte: 3 } }),
    countListingsForProductWhere({ deliveryMax: { lte: 7 } }),
    countListingsForProductWhere({
      OR: [{ freeShipping: true }, { freeShippingThreshold: { gt: 0 } }],
    }),
    offerCountsPromise,
  ])

  const isEn = locale === "en"
  const facets: MarketplaceFacet[] = []

  if (departments.length > 0) {
    facets.push({
      key: DEPT_FACET_KEY,
      label: facetLabel(DEPT_FACET_KEY, locale),
      values: departments,
    })
  }

  const priceValues = [
    {
      value: "under25",
      count: under25,
      label: isEn ? `Under ${currencySym}25` : isUsMarket ? `Moins de ${currencySym}25` : "Moins de 25 €",
    },
    {
      value: "25-100",
      count: mid,
      label: isEn
        ? `${currencySym}25 – ${currencySym}100`
        : isUsMarket
          ? `${currencySym}25 – ${currencySym}100`
          : "25 – 100 €",
    },
    {
      value: "over100",
      count: over100,
      label: isEn ? `Over ${currencySym}100` : isUsMarket ? `Plus de ${currencySym}100` : "Plus de 100 €",
    },
  ].filter((v) => v.count > 0)

  if (priceValues.length > 0) {
    facets.push({
      key: PRICE_FACET_KEY,
      label: facetLabel(PRICE_FACET_KEY, locale),
      values: priceValues.map((v) => ({ value: v.value, count: v.count })),
    })
  }

  const [frOrUsShip, euOrNaShip, worldwideShip] = shipFacetCounts

  const shipValues = isUsMarket
    ? [
        {
          value: "us",
          count: frOrUsShip,
          label: isEn ? "United States" : "États-Unis",
        },
        {
          value: "na",
          count: euOrNaShip,
          label: isEn ? "US & Canada" : "États-Unis & Canada",
        },
        {
          value: "worldwide",
          count: worldwideShip,
          label: isEn ? "Worldwide" : "International",
        },
      ].filter((v) => v.count > 0)
    : [
        { value: "fr", count: frOrUsShip, label: isEn ? "France" : "France" },
        {
          value: "eu",
          count: euOrNaShip,
          label: isEn
            ? `European Union (${EU_MEMBER_COUNT} countries)`
            : `Union européenne (${EU_MEMBER_COUNT} pays)`,
        },
        {
          value: "worldwide",
          count: worldwideShip,
          label: isEn ? "Worldwide" : "International",
        },
      ].filter((v) => v.count > 0)

  if (shipValues.length > 0) {
    facets.push({
      key: SHIPS_FACET_KEY,
      label: facetLabel(SHIPS_FACET_KEY, locale),
      values: shipValues.map((v) => ({ value: v.value, count: v.count })),
    })
  }

  const deliveryValues = [
    { value: "under3", count: under3 },
    { value: "under7", count: under7 },
  ].filter((v) => v.count > 0)

  if (deliveryValues.length > 0) {
    facets.push({
      key: DELIVERY_FACET_KEY,
      label: facetLabel(DELIVERY_FACET_KEY, locale),
      values: deliveryValues,
    })
  }

  if (freeShip > 0) {
    facets.push({
      key: FREE_SHIP_FACET_KEY,
      label: facetLabel(FREE_SHIP_FACET_KEY, locale),
      values: [{ value: "1", count: freeShip }],
    })
  }

  const offerValues = offerCounts
    .map(({ mode, count }) => {
      const slug = offerFacetSlug(mode)
      const badge = offerModeFilterLabel(mode, isEn ? "en" : "fr")
      if (!slug || !badge || count <= 0) return null
      return { value: slug, count, label: badge.shortLabel }
    })
    .filter((v): v is { value: string; count: number; label: string } => v != null)

  if (offerValues.length > 0) {
    facets.push({
      key: OFFER_FACET_KEY,
      label: facetLabel(OFFER_FACET_KEY, locale),
      values: offerValues.map((v) => ({ value: v.value, count: v.count })),
    })
  }

  return facets
}

export function parsePriceFacet(value: string | null): Prisma.ProductWhereInput | null {
  if (!value) return null
  switch (value) {
    case "under25":
      return {
        affiliateProducts: { some: { sellingPriceCents: { lte: 2500 } } },
      }
    case "25-100":
      return {
        affiliateProducts: {
          some: { sellingPriceCents: { gt: 2500, lte: 10000 } },
        },
      }
    case "over100":
      return {
        affiliateProducts: { some: { sellingPriceCents: { gt: 10000 } } },
      }
    default:
      return null
  }
}

