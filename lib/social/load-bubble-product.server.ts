import "server-only"

import type { BubbleProductView } from "@/lib/social/bubble-product-types"
import { psychologicalPrice } from "@/lib/import/smart-import-enricher"
import { isLocalhostHost } from "@/lib/localhost-host"
import { prisma } from "@/lib/prisma"
import { resolvePublicAppUrl } from "@/lib/public-app-url"

/** Local Next always speaks HTTP — never emit https://localhost (Chrome SSL protocol error). */
function bubbleAppOrigin(): string {
  const origin = resolvePublicAppUrl().replace(/\/$/, "")
  try {
    const u = new URL(origin)
    if (isLocalhostHost(u.hostname)) {
      u.protocol = "http:"
      return u.origin
    }
    return u.origin
  } catch {
    return origin.startsWith("http") ? origin : `http://${origin}`
  }
}

export async function loadBubbleProductView(productId: string): Promise<BubbleProductView | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, active: true },
    select: {
      id: true,
      name: true,
      images: true,
      basePriceCents: true,
      compareAt: true,
      deliveryDays: true,
      shippingCountry: true,
      supplier: {
        select: {
          name: true,
          trustScore: true,
        },
      },
    },
  })
  if (!product) return null

  const listing = await prisma.affiliateProduct.findFirst({
    where: { productId: product.id, isListed: true },
    select: { id: true, sellingPriceCents: true, customTitle: true, customImages: true },
    orderBy: { conversions: "desc" },
  })

  const cost = product.basePriceCents / 100
  const saleFromListing = listing ? listing.sellingPriceCents / 100 : null
  const sale = saleFromListing ?? psychologicalPrice(cost * 3.2)
  const marginEuro = Math.max(0, Math.round((sale - cost) * 100) / 100)
  const imageUrl =
    listing?.customImages?.[0]?.trim() ||
    product.images.find((u) => u?.startsWith("http")) ||
    product.images[0] ||
    null

  const appUrl = bubbleAppOrigin()

  return {
    id: product.id,
    title: listing?.customTitle?.trim() || product.name,
    imageUrl,
    salePrice: sale,
    compareAtPrice: product.compareAt != null ? Number(product.compareAt) : null,
    costPrice: cost,
    marginEuro,
    deliveryDays: product.deliveryDays ?? 5,
    deliveryCountry: product.shippingCountry?.trim().toUpperCase() || "FR",
    supplierTrustScore: product.supplier.trustScore ?? 75,
    supplierName: product.supplier.name,
    listingId: listing?.id ?? null,
    bubbleUrl: `${appUrl}/product/${product.id}/bubble`,
  }
}
