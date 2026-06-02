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

export async function loadSponsorHtCents(target: SponsorTarget): Promise<number> {
  const product = await prisma.product.findUnique({
    where: { id: target.productId },
    select: { basePriceCents: true },
  })
  return product?.basePriceCents ?? 0
}
