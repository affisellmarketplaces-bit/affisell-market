import type { Prisma } from "@prisma/client"

/**
 * Buyer-facing marketplace: only `AffiliateProduct` rows whose seller is an affiliate account.
 * Supplier storefront inventory (`/store/supplier/...`) uses `Product` directly and must not
 * surface as marketplace purchase rows.
 */
export const affiliateRoleMarketplaceWhere: Prisma.AffiliateProductWhereInput = {
  affiliate: { role: "AFFILIATE" },
}
