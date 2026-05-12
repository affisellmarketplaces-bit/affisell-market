import { auth } from "@/auth"
import { listingDisplayTitle, listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import { resolveCartLineImageUrl } from "@/lib/cart-line-image"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CartLineJson = {
  id: string
  qty: number
  sellerName: string | null
  variantSignature: string
  selectedColor: string | null
  selectedSize: string | null
  product: {
    id: string
    title: string
    price: number
    imageUrl: string
  }
}

/** Returns a JSON array of cart lines (empty when unauthenticated or empty cart). */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json([] as CartLineJson[])
  }

  const cart = await prisma.cart.findFirst({
    where: { userId: session.user.id },
    include: {
      items: {
        include: {
          affiliateProduct: {
            include: {
              product: true,
              affiliate: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  if (!cart?.items.length) {
    return Response.json([] as CartLineJson[])
  }

  const lines: CartLineJson[] = cart.items.map((row) => {
    const listing = row.affiliateProduct
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
      selectedColor: row.selectedColor,
    })

    return {
      id: row.id,
      qty: row.quantity,
      sellerName: listing.affiliate.name?.trim() || null,
      variantSignature: row.variantSignature,
      selectedColor: row.selectedColor,
      selectedSize: row.selectedSize,
      product: {
        id: listing.id,
        title: listingDisplayTitle(listing.customTitle, p.name),
        price: listing.sellingPriceCents / 100,
        imageUrl: imageUrl || listingPrimaryImageUrl(listing.customImages, p.images) || "",
      },
    }
  })

  return Response.json(lines)
}
