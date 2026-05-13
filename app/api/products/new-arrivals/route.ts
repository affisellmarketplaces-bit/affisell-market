import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"
import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"
import { publicPartnerSellerLabel } from "@/lib/public-seller-display"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const products = await prisma.product.findMany({
    where: { active: true, isDraft: false },
    take: 12,
    orderBy: { createdAt: "desc" },
  })

  const productIds = products.map((p) => p.id)
  const listings = await prisma.affiliateProduct.findMany({
    where: {
      ...affiliateRoleMarketplaceWhere,
      productId: { in: productIds },
      isListed: true,
      product: { active: true },
    },
    include: {
      affiliate: { select: { name: true, store: { select: { name: true, slug: true } } } },
    },
    orderBy: { id: "asc" },
  })

  const firstByProduct = new Map<
    string,
    { listingId: string; sellingPriceCents: number; sellerLabel: string }
  >()
  for (const l of listings) {
    if (firstByProduct.has(l.productId)) continue
    firstByProduct.set(l.productId, {
      listingId: l.id,
      sellingPriceCents: l.sellingPriceCents,
      sellerLabel: publicPartnerSellerLabel({
        storeName: l.affiliate.store?.name,
        affiliateDisplayName: l.affiliate.name,
      }),
    })
  }

  const items = products
    .map((p) => {
      const meta = firstByProduct.get(p.id)
      if (!meta) return null
      return {
        id: p.id,
        name: p.name,
        imageUrl: primaryProductImage(p.images) || null,
        priceCents: meta.sellingPriceCents,
        href: `/marketplace/${meta.listingId}`,
        storeName: meta.sellerLabel,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  return Response.json({ items })
}
