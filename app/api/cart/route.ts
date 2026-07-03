import { auth } from "@/auth"
import { listingDisplayTitle, listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import { resolveCartLineImageUrl } from "@/lib/cart-line-image"
import { prisma } from "@/lib/prisma"
import { marketplaceSellingPriceCentsForOption, variantsFromDb } from "@/lib/product-variants"
import {
  parseAffiliateVariantPricingJson,
  resolveAffiliateSellingPriceCentsForOption,
} from "@/lib/affiliate-variant-pricing"

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
              affiliate: { select: { name: true, role: true } },
            },
          },
        },
      },
    },
  })

  if (!cart?.items.length) {
    return Response.json([] as CartLineJson[])
  }

  const lines: CartLineJson[] = cart.items
    .filter((row) => row.affiliateProduct.affiliate.role === "AFFILIATE")
    .map((row) => {
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

    const variants = variantsFromDb(p.variants)
    const variantPricing = parseAffiliateVariantPricingJson(listing.variantPricing)
    const unitCents = resolveAffiliateSellingPriceCentsForOption({
      listingSellingPriceCents: listing.sellingPriceCents,
      productBasePriceCents: p.basePriceCents,
      variants,
      optionName: row.selectedColor,
      variantPricing,
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
        price: unitCents / 100,
        imageUrl: imageUrl || listingPrimaryImageUrl(listing.customImages, p.images) || "",
      },
    }
  })

  return Response.json(lines)
}
