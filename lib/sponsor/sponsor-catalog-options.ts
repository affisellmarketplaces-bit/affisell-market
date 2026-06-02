import { prisma } from "@/lib/prisma"

export async function loadSupplierSponsorOptions(userId: string) {
  return prisma.product.findMany({
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
