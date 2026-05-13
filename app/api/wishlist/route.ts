import { auth } from "@/auth"
import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function dropPercent(current: number, previous: number | null): number {
  if (!previous || previous <= 0 || current >= previous) return 0
  return Math.max(1, Math.round(((previous - current) / previous) * 100))
}

async function currentPriceForProduct(productId: string): Promise<number | null> {
  const listing = await prisma.affiliateProduct.findFirst({
    where: {
      productId,
      isListed: true,
      product: { active: true },
      ...affiliateRoleMarketplaceWhere,
    },
    orderBy: { id: "asc" },
    select: { sellingPriceCents: true },
  })
  return listing?.sellingPriceCents ?? null
}

export async function GET(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return Response.json({ wished: false, items: [] })

  const productId = new URL(req.url).searchParams.get("productId")?.trim() || ""
  if (productId) {
    const item = await prisma.wishlist.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { targetPriceCents: true, previousPriceCents: true, productId: true },
    })
    if (!item) return Response.json({ wished: false })
    const current = await currentPriceForProduct(productId)
    return Response.json({
      wished: true,
      productId,
      targetPriceCents: item.targetPriceCents,
      dropPercent: current != null ? dropPercent(current, item.previousPriceCents) : 0,
    })
  }

  const rows = await prisma.wishlist.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      productId: true,
      targetPriceCents: true,
      previousPriceCents: true,
      product: { select: { name: true, images: true } },
    },
  })
  const priced = await Promise.all(
    rows.map(async (r) => {
      const currentPriceCents = await currentPriceForProduct(r.productId)
      return {
        productId: r.productId,
        name: r.product.name,
        imageUrl: r.product.images[0] ?? null,
        targetPriceCents: r.targetPriceCents,
        currentPriceCents,
        dropPercent: currentPriceCents != null ? dropPercent(currentPriceCents, r.previousPriceCents) : 0,
      }
    })
  )
  return Response.json({ items: priced })
}

export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    productId?: string
    targetPrice?: number
  }
  const productId = typeof body.productId === "string" ? body.productId.trim() : ""
  if (!productId) return Response.json({ error: "Missing productId" }, { status: 400 })

  const product = await prisma.product.findFirst({
    where: { id: productId, active: true },
    select: { id: true },
  })
  if (!product) return Response.json({ error: "Product not found" }, { status: 404 })

  const exists = await prisma.wishlist.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true },
  })

  if (exists) {
    await prisma.wishlist.delete({ where: { userId_productId: { userId, productId } } })
    return Response.json({ wished: false })
  }

  const targetPriceCents =
    typeof body.targetPrice === "number" && Number.isFinite(body.targetPrice) && body.targetPrice > 0
      ? Math.round(body.targetPrice * 100)
      : null
  const current = await currentPriceForProduct(productId)

  await prisma.wishlist.create({
    data: {
      userId,
      productId,
      targetPriceCents,
      previousPriceCents: current ?? undefined,
    },
  })

  return Response.json({ wished: true })
}
