import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"
import { prisma } from "@/lib/prisma"
import { resolveCartLineImageUrl } from "@/lib/cart-line-image"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Public: resolve preview image for a marketplace listing + optional color (guest cart refresh). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const listingId = searchParams.get("listingId")?.trim() ?? ""
  const color = searchParams.get("color")?.trim() ?? ""
  if (!listingId) {
    return Response.json({ error: "Missing listingId" }, { status: 400 })
  }

  const listing = await prisma.affiliateProduct.findFirst({
    where: {
      id: listingId,
      isListed: true,
      product: { active: true },
      ...affiliateRoleMarketplaceWhere,
    },
    include: { product: true },
  })
  if (!listing?.product) {
    return Response.json({ imageUrl: "" }, { status: 404 })
  }

  const p = listing.product
  const colors = Array.isArray(p.colors)
    ? p.colors.filter((c): c is string => typeof c === "string" && Boolean(c.trim()))
    : []

  const imageUrl = resolveCartLineImageUrl({
    customImages: listing.customImages,
    productImages: p.images ?? [],
    productColors: colors,
    colorImagesJson: p.colorImages,
    variantsJson: p.variants,
    selectedColor: color || null,
  })

  return Response.json({ imageUrl: imageUrl || "" })
}
