import type { PrismaClient } from "@prisma/client"

import { buildCategoryScopeProductFilter } from "@/lib/marketplace-category-product-filter"
import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"

const listedProductBase = {
  active: true,
  isDraft: false,
} as const

/** Count affiliate marketplace listings whose product matches a category subtree. */
export async function countListedProductsInCategoryScope(
  client: PrismaClient,
  scopeRootId: string
): Promise<number> {
  const categoryScope = await buildCategoryScopeProductFilter(client, scopeRootId)
  return client.affiliateProduct.count({
    where: {
      ...affiliateRoleMarketplaceWhere,
      isListed: true,
      product: {
        ...listedProductBase,
        ...categoryScope,
      },
    },
  })
}
