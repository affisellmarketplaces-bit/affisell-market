import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"
import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"
import { publicPartnerSellerLabel } from "@/lib/public-seller-display"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
  const listings = await prisma.affiliateProduct.findMany({
    where: {
      ...affiliateRoleMarketplaceWhere,
      isListed: true,
      product: { active: true, isDraft: false },
    },
    include: {
      product: { select: { id: true, name: true, images: true, createdAt: true } },
      affiliate: { select: { name: true, store: { select: { name: true, slug: true } } } },
    },
    orderBy: { product: { createdAt: "desc" } },
    take: 48,
  })

  const seen = new Set<string>()
  const items: {
    id: string
    name: string
    imageUrl: string | null
    priceCents: number
    href: string
    storeName: string
  }[] = []

  for (const l of listings) {
    const p = l.product
    if (!p || seen.has(p.id)) continue
    seen.add(p.id)
    items.push({
      id: p.id,
      name: p.name,
      imageUrl: primaryProductImage(p.images) || null,
      priceCents: l.sellingPriceCents,
      href: `/marketplace/${l.id}`,
      storeName: publicPartnerSellerLabel({
        storeName: l.affiliate.store?.name,
        affiliateDisplayName: l.affiliate.name,
      }),
    })
    if (items.length >= 12) break
  }

  return Response.json({ items })
  } catch (e) {
    console.error("[api/products/new-arrivals]", e)
    return Response.json({ items: [], ...dbUnavailablePayload(e) }, { status: 503 })
  }
}
