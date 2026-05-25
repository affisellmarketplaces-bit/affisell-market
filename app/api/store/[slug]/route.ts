import { buyerMarketplaceProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"
import {
  listingDisplayTitle,
  listingPrimaryImageUrl,
  listingGalleryUrls,
} from "@/lib/affiliate-listing-display"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const store = await prisma.store.findUnique({
    where: { slug },
    include: { user: { select: { id: true, role: true } } },
  })

  if (!store) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const role = store.user.role

  if (role !== "AFFILIATE") {
    return Response.json({
      store: {
        name: store.name,
        slug: store.slug,
        logoUrl: store.logoUrl,
        aiAvatarUrl: store.aiAvatarUrl,
        bannerUrl: store.bannerUrl,
        description: store.description,
        ownerRole: role,
      },
      listings: [],
    })
  }

  const listings = await prisma.affiliateProduct.findMany({
    where: { affiliateId: store.user.id, isListed: true, product: buyerMarketplaceProductWhere },
    include: { product: true },
    orderBy: [{ position: "asc" }, { id: "asc" }],
  })

  const items = listings
    .filter((l) => l.product)
    .map((l) => ({
      listingId: l.id,
      productId: l.productId,
      href: `/marketplace/${l.id}`,
      title: listingDisplayTitle(l.customTitle, l.product!.name),
      descriptionSnippet: (l.customDescription ?? l.product!.description ?? "").slice(0, 200),
      priceCents: l.sellingPriceCents,
      imageUrl:
        listingPrimaryImageUrl(l.customImages, l.product!.images) || null,
      gallery: listingGalleryUrls(l.customImages, l.product!.images),
      conversions: l.conversions,
      clicks: l.clicks,
      customSlug: l.customSlug,
    }))

  return Response.json({
    store: {
      name: store.name,
      slug: store.slug,
      logoUrl: store.logoUrl,
      aiAvatarUrl: store.aiAvatarUrl,
      bannerUrl: store.bannerUrl,
      description: store.description,
      ownerRole: role,
      affiliateStoreName: store.name,
    },
    listings: items,
  })
}
