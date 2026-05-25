import type { PrismaClient } from "@prisma/client"

import { buildCategoryScopeProductFilter } from "@/lib/marketplace-category-product-filter"
import { buyerListedAffiliateProductWhere, buyerMarketplaceProductWhere } from "@/lib/marketplace-buyer-product-filter"

/** Count affiliate marketplace listings whose product matches a category subtree. */
export async function countListedProductsInCategoryScope(
  client: PrismaClient,
  scopeRootId: string
): Promise<number> {
  const categoryScope = await buildCategoryScopeProductFilter(client, scopeRootId)
  return client.affiliateProduct.count({
    where: {
      ...buyerListedAffiliateProductWhere,
      product: {
        ...buyerMarketplaceProductWhere,
        ...categoryScope,
      },
    },
  })
}
