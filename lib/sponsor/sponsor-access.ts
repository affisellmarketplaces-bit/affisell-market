import { prisma } from "@/lib/prisma"

export type SponsorTarget =
  | { payerRole: "SUPPLIER"; productId: string; affiliateProductId?: null }
  | { payerRole: "AFFILIATE"; productId: string; affiliateProductId: string }

export async function resolveSponsorTarget(
  userId: string,
  role: string,
  input: { productId?: string; affiliateProductId?: string }
): Promise<SponsorTarget | { error: string; status: number }> {
  if (role === "SUPPLIER") {
    const productId = input.productId?.trim()
    if (!productId) {
      return { error: "productId is required for suppliers", status: 400 }
    }
    const product = await prisma.product.findFirst({
      where: { id: productId, supplierId: userId, isDraft: false, active: true },
      select: { id: true, basePriceCents: true, name: true },
    })
    if (!product) {
      return { error: "Product not found or not yours", status: 404 }
    }
    return { payerRole: "SUPPLIER", productId: product.id, affiliateProductId: null }
  }

  if (role === "AFFILIATE") {
    const affiliateProductId = input.affiliateProductId?.trim()
    if (!affiliateProductId) {
      return { error: "affiliateProductId is required for affiliates", status: 400 }
    }
    const listing = await prisma.affiliateProduct.findFirst({
      where: {
        id: affiliateProductId,
        affiliateId: userId,
        isListed: true,
        product: { active: true, isDraft: false },
      },
      select: {
        id: true,
        productId: true,
        product: { select: { basePriceCents: true, name: true } },
      },
    })
    if (!listing) {
      return { error: "Listing not found or not yours", status: 404 }
    }
    return {
      payerRole: "AFFILIATE",
      productId: listing.productId,
      affiliateProductId: listing.id,
    }
  }

  return { error: "Only suppliers and affiliates can sponsor products", status: 403 }
}

/**
 * The success fee is charged per sale against the buyer's actual paid HT price
 * (lib/stripe-marketplace-fulfill.ts's clientLineHtCents via settlement.affisellFeeBaseCents),
 * which is normally higher than the product's wholesale cost once an affiliate's markup is
 * added. This must quote against that same basis so the preview the payer approves before
 * activating isn't understated vs. what actually gets deducted on a real sale.
 */
export async function loadSponsorHtCents(target: SponsorTarget): Promise<number> {
  if (target.payerRole === "AFFILIATE" && target.affiliateProductId) {
    const listing = await prisma.affiliateProduct.findUnique({
      where: { id: target.affiliateProductId },
      select: { sellingPriceCents: true },
    })
    if (listing) return listing.sellingPriceCents
  }

  // Supplier: no single selling price exists on the bare product (each affiliate sets their
  // own), so estimate from the average of the product's current live listings — the closest
  // available proxy for what a buyer will actually pay.
  const avg = await prisma.affiliateProduct.aggregate({
    where: { productId: target.productId, isListed: true },
    _avg: { sellingPriceCents: true },
  })
  if (avg._avg.sellingPriceCents) return Math.round(avg._avg.sellingPriceCents)

  const product = await prisma.product.findUnique({
    where: { id: target.productId },
    select: { basePriceCents: true },
  })
  return product?.basePriceCents ?? 0
}
