import { prisma } from "@/lib/prisma"

/**
 * When an invited supplier publishes their first SKU, prepare a draft listing for the inviting affiliate.
 */
export async function ensureInviterDraftListingForInvite(args: {
  affiliateId: string
  productId: string
}): Promise<{ created: boolean; listingId: string | null }> {
  const existing = await prisma.affiliateProduct.findUnique({
    where: {
      affiliateId_productId: {
        affiliateId: args.affiliateId,
        productId: args.productId,
      },
    },
    select: { id: true },
  })
  if (existing) return { created: false, listingId: existing.id }

  const product = await prisma.product.findFirst({
    where: { id: args.productId, active: true, isDraft: false },
    select: { basePriceCents: true },
  })
  if (!product) return { created: false, listingId: null }

  const maxPos = await prisma.affiliateProduct.aggregate({
    where: { affiliateId: args.affiliateId },
    _max: { position: true },
  })
  const position = (maxPos._max.position ?? -1) + 1

  const row = await prisma.affiliateProduct.create({
    data: {
      affiliateId: args.affiliateId,
      productId: args.productId,
      sellingPriceCents: product.basePriceCents,
      isListed: false,
      isFeatured: false,
      position,
    },
    select: { id: true },
  })

  return { created: true, listingId: row.id }
}
