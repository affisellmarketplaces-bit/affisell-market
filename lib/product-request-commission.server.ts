import { psychologicalPrice } from "@/lib/import/smart-import-enricher"
import { prisma } from "@/lib/prisma"

/**
 * After quote accept: create supplier Product draft + reseller AffiliateProduct draft (isListed=false).
 * Idempotent on tag `request:{requestId}` for the reseller.
 */
export async function createProductRequestCommissionDraft(args: {
  requestId: string
  title: string
  description: string | null
  category: string
  imageUrl: string | null
  resellerId: string
  supplierId: string
  unitPrice: number
  moq: number
  deliveryDays: number
}): Promise<{ productId: string; affiliateProductId: string } | null> {
  const tag = `request:${args.requestId}`
  const existingListing = await prisma.affiliateProduct.findFirst({
    where: {
      affiliateId: args.resellerId,
      customDescription: { contains: tag },
    },
    select: { id: true, productId: true },
  })
  if (existingListing) {
    console.log("[COMMISSION]", {
      requestId: args.requestId,
      result: "draft_already_exists",
      affiliateProductId: existingListing.id,
    })
    return {
      productId: existingListing.productId,
      affiliateProductId: existingListing.id,
    }
  }

  const costPrice = Math.max(0.01, args.unitPrice)
  const salePrice = psychologicalPrice(costPrice * 3.2)
  const costCents = Math.max(1, Math.round(costPrice * 100))
  const saleCents = Math.max(costCents + 1, Math.round(salePrice * 100))
  const marginCents = Math.max(0, saleCents - costCents)

  const product = await prisma.product.create({
    data: {
      supplierId: args.supplierId,
      name: args.title.slice(0, 200),
      description:
        (args.description?.trim() || args.title).slice(0, 4000) +
        `\n\nsource=product_request ${tag}`,
      images: args.imageUrl ? [args.imageUrl] : [],
      categories: [args.category],
      tags: [tag, "product_request"],
      basePriceCents: costCents,
      commissionRate: 15,
      stock: Math.max(args.moq, 0),
      minOrderQuantity: Math.max(1, args.moq),
      deliveryDays: Math.max(1, args.deliveryDays),
      active: false,
      isDraft: true,
      importSource: "product_request",
    },
    select: { id: true },
  })

  const listing = await prisma.affiliateProduct.create({
    data: {
      affiliateId: args.resellerId,
      productId: product.id,
      sellingPriceCents: saleCents,
      marginCents,
      customTitle: args.title.slice(0, 200),
      customDescription: `source=product_request ${tag}\ncost=${costPrice}\nsale=${salePrice}`,
      customImages: args.imageUrl ? [args.imageUrl] : [],
      isListed: false,
    },
    select: { id: true },
  })

  console.log("[COMMISSION]", {
    requestId: args.requestId,
    result: "Product draft créé - Commission future",
    productId: product.id,
    affiliateProductId: listing.id,
    costPrice,
    salePrice,
  })

  return { productId: product.id, affiliateProductId: listing.id }
}
