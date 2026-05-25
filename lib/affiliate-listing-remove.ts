import { affiliateListingsWhere, requireMerchantUserId } from "@/lib/merchant-tenant-scope"
import { prisma } from "@/lib/prisma"

export type RemoveAffiliateListingsResult = {
  /** Hard-deleted listing ids (no order history). */
  deletedIds: string[]
  /** Unlisted only — kept for order history. */
  hiddenIds: string[]
}

/**
 * Remove affiliate listings from the public storefront.
 * Deletes rows when safe; otherwise sets `isListed: false` (orders reference the listing).
 */
export async function removeAffiliateListingsFromStorefront(
  affiliateId: string,
  listingIds: string[]
): Promise<RemoveAffiliateListingsResult> {
  const ids = [...new Set(listingIds.map((id) => id.trim()).filter(Boolean))].slice(0, 200)
  if (ids.length === 0) return { deletedIds: [], hiddenIds: [] }

  const tenantId = requireMerchantUserId(affiliateId, "affiliate")
  const owned = await prisma.affiliateProduct.findMany({
    where: { id: { in: ids }, ...affiliateListingsWhere(tenantId) },
    select: { id: true },
  })
  const ownedIds = owned.map((r) => r.id)
  if (ownedIds.length === 0) return { deletedIds: [], hiddenIds: [] }

  const orderGroups = await prisma.order.groupBy({
    by: ["affiliateProductId"],
    where: { affiliateProductId: { in: ownedIds } },
    _count: { _all: true },
  })
  const withOrders = new Set(
    orderGroups.filter((g) => g._count._all > 0).map((g) => g.affiliateProductId)
  )

  const deletable = ownedIds.filter((id) => !withOrders.has(id))
  const hiddenOnly = ownedIds.filter((id) => withOrders.has(id))

  if (deletable.length > 0) {
    await prisma.affiliateProduct.deleteMany({
      where: { id: { in: deletable }, ...affiliateListingsWhere(tenantId) },
    })
  }

  if (hiddenOnly.length > 0) {
    await prisma.affiliateProduct.updateMany({
      where: { id: { in: hiddenOnly }, ...affiliateListingsWhere(tenantId) },
      data: { isListed: false, isFeatured: false },
    })
  }

  return { deletedIds: deletable, hiddenIds: hiddenOnly }
}
