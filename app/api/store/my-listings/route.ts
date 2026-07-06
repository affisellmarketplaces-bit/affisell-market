import { auth } from "@/auth"
import {
  buyerListedAffiliateProductWhere,
  buyerMarketplaceProductWhere,
} from "@/lib/marketplace-buyer-product-filter"
import {
  listingDisplayTitle,
  listingPrimaryImageUrl,
} from "@/lib/affiliate-listing-display"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Merchant catalog picks for Brand Studio flash sale editor. */
export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!userId) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (role !== "AFFILIATE" && role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  if (role === "SUPPLIER") {
    return Response.json({ items: [] })
  }

  const rows = await prisma.affiliateProduct.findMany({
    where: {
      affiliateId: userId,
      ...buyerListedAffiliateProductWhere,
      product: buyerMarketplaceProductWhere,
    },
    select: {
      id: true,
      sellingPriceCents: true,
      customTitle: true,
      customImages: true,
      product: { select: { name: true, images: true } },
    },
    orderBy: [{ conversions: "desc" }, { updatedAt: "desc" }],
    take: 48,
  })

  const items = rows.map((row) => ({
    listingId: row.id,
    title: listingDisplayTitle(row.customTitle, row.product.name),
    imageUrl: listingPrimaryImageUrl(row.customImages, row.product.images) || null,
    priceCents: row.sellingPriceCents,
  }))

  return Response.json(
    { items },
    { headers: { "Cache-Control": "private, no-store" } }
  )
}
