import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const products = await prisma.product.findMany({
    where: { active: true },
    take: 12,
    orderBy: { createdAt: "desc" },
    include: {
      supplier: {
        include: { store: { select: { name: true, slug: true } } },
      },
    },
  })

  const productIds = products.map((p) => p.id)
  const listings = await prisma.affiliateProduct.findMany({
    where: {
      productId: { in: productIds },
      isListed: true,
      product: { active: true },
    },
    select: { id: true, productId: true },
    orderBy: { id: "asc" },
  })
  const firstListingByProduct = new Map<string, string>()
  for (const l of listings) {
    if (!firstListingByProduct.has(l.productId)) {
      firstListingByProduct.set(l.productId, l.id)
    }
  }

  const items = products.map((p) => {
    const listingId = firstListingByProduct.get(p.id)
    return {
      id: p.id,
      name: p.name,
      imageUrl: primaryProductImage(p.images) || null,
      priceCents: p.basePriceCents,
      href: listingId ? `/marketplace/${listingId}` : "/marketplace",
      storeName: p.supplier.store?.name ?? p.supplier.name?.trim() ?? "Verified seller",
    }
  })

  return Response.json({ items })
}
