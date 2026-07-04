import { auth } from "@/auth"
import { previewWholesaleChangeFromDraft } from "@/lib/supplier-wholesale-change-preview"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const existing = await prisma.product.findFirst({
    where: { id, supplierId: session.user.id },
    select: {
      basePriceCents: true,
      variants: true,
      colors: true,
      hasVariants: true,
      isDraft: true,
      active: true,
      productVariants: {
        select: {
          color: true,
          size: true,
          stock: true,
          supplierPrice: true,
          wholesalePriceCents: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  if (existing.isDraft || !existing.active) {
    return Response.json({
      hasIncrease: false,
      affiliateListingsLive: 0,
      listingsAtRisk: 0,
      atLossCount: 0,
      increaseCount: 0,
      skipped: true,
    })
  }

  let rawBody: Record<string, unknown>
  try {
    rawBody = (await req.json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const listings = await prisma.affiliateProduct.findMany({
    where: { productId: id, isListed: true },
    select: {
      sellingPriceCents: true,
      variantPricing: true,
    },
  })

  const preview = previewWholesaleChangeFromDraft(existing, rawBody, listings)

  console.log("[wholesale-preview]", {
    productId: id,
    hasIncrease: preview.hasIncrease,
    listingsAtRisk: preview.listingsAtRisk,
    affiliateListingsLive: preview.affiliateListingsLive,
  })

  return Response.json(preview)
}
