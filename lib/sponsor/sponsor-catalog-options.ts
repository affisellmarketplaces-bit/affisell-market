import { prisma } from "@/lib/prisma"

export async function loadSupplierSponsorOptions(userId: string) {
  const products = await prisma.product.findMany({
    where: { supplierId: userId, active: true, isDraft: false },
    orderBy: { updatedAt: "desc" },
    take: 80,
    select: {
      id: true,
      name: true,
      images: true,
      basePriceCents: true,
    },
  })

  // The success fee is charged per sale against the buyer's paid HT price, not the supplier's
  // wholesale cost (see lib/sponsor/sponsor-access.ts's loadSponsorHtCents) — show the same
  // average-listing-price estimate here so the catalog preview matches the real quote basis
  // instead of silently showing a lower, misleading number.
  const avgSellingPriceByProduct =
    products.length > 0
      ? await prisma.affiliateProduct.groupBy({
          by: ["productId"],
          where: { productId: { in: products.map((p) => p.id) }, isListed: true },
          _avg: { sellingPriceCents: true },
        })
      : []
  const avgByProductId = new Map(
    avgSellingPriceByProduct.map((row) => [row.productId, row._avg.sellingPriceCents])
  )

  return products.map((p) => ({
    ...p,
    estimatedSellingPriceCents: avgByProductId.get(p.id)
      ? Math.round(avgByProductId.get(p.id)!)
      : null,
  }))
}

export async function loadAffiliateSponsorOptions(userId: string) {
  return prisma.affiliateProduct.findMany({
    where: {
      affiliateId: userId,
      isListed: true,
      product: { active: true, isDraft: false },
    },
    orderBy: { updatedAt: "desc" },
    take: 80,
    select: {
      id: true,
      customTitle: true,
      sellingPriceCents: true,
      product: {
        select: {
          id: true,
          name: true,
          images: true,
          basePriceCents: true,
        },
      },
    },
  })
}
