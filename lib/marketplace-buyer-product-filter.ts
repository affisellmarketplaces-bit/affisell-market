import type { Prisma } from "@prisma/client"

import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"

/** Internal QA / Stripe test SKUs — never show on buyer marketplace or shop PDP. */
export const INTERNAL_TEST_PRODUCT_NAMES = [
  "Test 3Way Split",
  "Test Three Way Split",
  "Produit Test TVA Affisell",
] as const

export const INTERNAL_TEST_PRODUCT_IDS = [
  "test_product_3way",
  "cmpiddd890003thlps6tp",
] as const

const excludeInternalTests: Prisma.ProductWhereInput = {
  NOT: {
    OR: [
      ...INTERNAL_TEST_PRODUCT_NAMES.map((name) => ({
        name: { equals: name, mode: "insensitive" as const },
      })),
      { id: { in: [...INTERNAL_TEST_PRODUCT_IDS] } },
    ],
  },
}

/** Product rows visible to shoppers (catalog, PDP, checkout). */
export const buyerMarketplaceProductWhere: Prisma.ProductWhereInput = {
  active: true,
  isDraft: false,
  ...excludeInternalTests,
}

/** Listed affiliate SKU on the public marketplace. */
export const buyerListedAffiliateProductWhere: Prisma.AffiliateProductWhereInput = {
  ...affiliateRoleMarketplaceWhere,
  isListed: true,
  product: buyerMarketplaceProductWhere,
}

export function isInternalTestProductName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase()
  if (!n) return false
  return INTERNAL_TEST_PRODUCT_NAMES.some((label) => n === label.toLowerCase())
}

export function isInternalTestProductId(id: string | null | undefined): boolean {
  const v = (id ?? "").trim()
  if (!v) return false
  return INTERNAL_TEST_PRODUCT_IDS.includes(v as (typeof INTERNAL_TEST_PRODUCT_IDS)[number])
}
