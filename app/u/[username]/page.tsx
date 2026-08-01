import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { StoreTemplate } from "@/components/store/StoreTemplate"
import {
  isValidLegionUsername,
  LEGION_RESERVED_USERNAMES,
  normalizeLegionUsername,
} from "@/lib/legion/username"
import { listingGalleryUrls } from "@/lib/affiliate-listing-display"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 60

type PageProps = {
  params: Promise<{ username: string }>
  searchParams: Promise<{ ref?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username: raw } = await params
  const username = normalizeLegionUsername(raw)
  return {
    title: `@${username} Boutique Affisell`,
    description: `Boutique Légion @${username} — Affisell marketplace.`,
  }
}

export default async function LegionStorefrontPage({ params, searchParams }: PageProps) {
  const { username: raw } = await params
  const sp = await searchParams
  const username = normalizeLegionUsername(raw)

  if (
    LEGION_RESERVED_USERNAMES.has(username) ||
    !isValidLegionUsername(username)
  ) {
    notFound()
  }

  const profile = await prisma.storeProfile.findFirst({
    where: { username, isActive: true },
  })
  if (!profile) notFound()

  const affiliateListings = await prisma.affiliateProduct.findMany({
    where: {
      affiliateId: profile.userId,
      isListed: true,
    },
    take: 24,
    orderBy: [{ isFeatured: "desc" }, { position: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      customTitle: true,
      customImages: true,
      sellingPriceCents: true,
      marginCents: true,
      product: {
        select: {
          name: true,
          images: true,
          basePriceCents: true,
        },
      },
    },
  })

  let products = affiliateListings.map((row) => {
    const gallery = listingGalleryUrls(row.customImages, row.product.images)
    const price = row.sellingPriceCents
    const cost = row.product.basePriceCents
    const marginPct =
      price > 0 ? Math.round(((price - cost) / price) * 100) : null
    return {
      id: row.id,
      name: row.customTitle?.trim() || row.product.name,
      imageUrl: gallery[0] ?? null,
      priceCents: price,
      marginLabel: marginPct != null && marginPct > 0 ? `Marge ~${marginPct}%` : null,
      href: `/marketplace/${row.id}`,
    }
  })

  if (products.length === 0) {
    const featured = await prisma.affiliateProduct.findMany({
      where: { isListed: true, isFeatured: true },
      take: 12,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        customTitle: true,
        customImages: true,
        sellingPriceCents: true,
        product: { select: { name: true, images: true } },
      },
    })
    products = featured.map((row) => {
      const gallery = listingGalleryUrls(row.customImages, row.product.images)
      return {
        id: row.id,
        name: row.customTitle?.trim() || row.product.name,
        imageUrl: gallery[0] ?? null,
        priceCents: row.sellingPriceCents,
        marginLabel: null,
        href: `/marketplace/${row.id}`,
      }
    })
  }

  const referralRef = sp.ref ? normalizeLegionUsername(sp.ref) : null

  return (
    <StoreTemplate
      profile={{
        username: profile.username,
        displayName: profile.displayName?.trim() || profile.username,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        tiktokUrl: profile.tiktokUrl,
        instagramUrl: profile.instagramUrl,
        totalSales: profile.totalSales,
      }}
      products={products}
      referralRef={
        referralRef &&
        referralRef !== profile.username &&
        isValidLegionUsername(referralRef)
          ? referralRef
          : null
      }
    />
  )
}
