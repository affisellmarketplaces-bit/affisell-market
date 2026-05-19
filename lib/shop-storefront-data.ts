import { listingDisplayTitle, listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"

export type ShopStoreSummary = {
  slug: string
  name: string
  description: string | null
  logoUrl: string | null
  aiAvatarUrl: string | null
  nicheLabel: string
}

export type ShopProductCard = {
  listingId: string
  productId: string
  name: string
  imageUrl: string | null
  priceCents: number
  compareAtCents: number | null
  freeShipping: boolean
  stock: number
  averageRating: number
  reviewCount: number
}

function inferNicheLabel(description: string | null, storeName: string): string {
  const text = `${description ?? ""} ${storeName}`.toLowerCase()
  if (/fitness|sport|gym|muscu/.test(text)) return "Fitness"
  if (/tech|électron|electron|gaming|informatique/.test(text)) return "Tech"
  if (/maison|déco|deco|cuisine|home/.test(text)) return "Maison"
  return "Lifestyle"
}

export async function loadAffiliateShopStore(slug: string): Promise<ShopStoreSummary | null> {
  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      description: true,
      logoUrl: true,
      aiAvatarUrl: true,
      user: { select: { role: true } },
    },
  })
  if (!store || store.user.role !== "AFFILIATE") return null

  return {
    slug: store.slug,
    name: store.name,
    description: store.description,
    logoUrl: store.logoUrl,
    aiAvatarUrl: store.aiAvatarUrl,
    nicheLabel: inferNicheLabel(store.description, store.name),
  }
}

export async function loadAffiliateShopProducts(
  affiliateUserId: string,
  limit = 48
): Promise<ShopProductCard[]> {
  const listings = await prisma.affiliateProduct.findMany({
    where: {
      affiliateId: affiliateUserId,
      isListed: true,
      product: { active: true, isDraft: false },
    },
    select: {
      id: true,
      sellingPriceCents: true,
      customTitle: true,
      customImages: true,
      product: {
        select: {
          id: true,
          name: true,
          images: true,
          stock: true,
          freeShipping: true,
          compareAt: true,
          basePriceCents: true,
          averageRating: true,
          reviewCount: true,
        },
      },
    },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    take: limit,
  })

  return listings
    .filter((l) => l.product)
    .map((l) => {
      const p = l.product!
      const compareAt =
        p.compareAt != null && Number(p.compareAt) > 0 ? Math.round(Number(p.compareAt) * 100) : null
      return {
        listingId: l.id,
        productId: p.id,
        name: listingDisplayTitle(l.customTitle, p.name),
        imageUrl:
          listingPrimaryImageUrl(l.customImages, p.images) || primaryProductImage(p.images) || null,
        priceCents: l.sellingPriceCents,
        compareAtCents:
          compareAt != null && compareAt > l.sellingPriceCents ? compareAt : null,
        freeShipping: p.freeShipping,
        stock: p.stock,
        averageRating: p.averageRating,
        reviewCount: p.reviewCount,
      }
    })
}

export async function loadPublicAffiliateShops(limit = 24): Promise<
  { slug: string; name: string; logoUrl: string | null; nicheLabel: string }[]
> {
  const stores = await prisma.store.findMany({
    where: { user: { role: "AFFILIATE" } },
    select: { slug: true, name: true, logoUrl: true, aiAvatarUrl: true, description: true },
    orderBy: { name: "asc" },
    take: limit,
  })

  return stores.map((s) => ({
    slug: s.slug,
    name: s.name,
    logoUrl: s.logoUrl ?? s.aiAvatarUrl,
    nicheLabel: inferNicheLabel(s.description, s.name),
  }))
}

export function shopProductToCardProps(item: ShopProductCard, affiliateSlug: string) {
  return {
    listingId: item.listingId,
    productId: item.productId,
    title: item.name,
    name: item.name,
    image: item.imageUrl ?? undefined,
    price: item.priceCents / 100,
    compareAt: item.compareAtCents != null ? item.compareAtCents / 100 : null,
    freeShipping: item.freeShipping,
    stock: item.stock,
    averageRating: item.averageRating,
    reviewCount: item.reviewCount,
    href: `/shop/${affiliateSlug}/product/${item.listingId}`,
  }
}
