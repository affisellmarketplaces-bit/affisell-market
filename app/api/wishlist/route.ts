import { auth } from "@/auth"
import { getOrCreateGuestWishlistId, readGuestWishlistId } from "@/lib/guest-wishlist-id"
import {
  guestWishlistProductIds,
  listGuestWishlistForDisplay,
  toggleGuestWishlist,
} from "@/lib/guest-wishlist-server"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { countProductLikes, countProductLikesSingle } from "@/lib/product-like-count"
import { prisma } from "@/lib/prisma"
import { resolveWishlistCardStatuses } from "@/lib/wishlist-card-status.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function dropPercent(current: number, previous: number | null): number {
  if (!previous || previous <= 0 || current >= previous) return 0
  return Math.max(1, Math.round(((previous - current) / previous) * 100))
}

async function currentPricesForProducts(productIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (productIds.length === 0) return map

  const listings = await prisma.affiliateProduct.findMany({
    where: {
      productId: { in: productIds },
      ...buyerListedAffiliateProductWhere,
    },
    select: { productId: true, sellingPriceCents: true },
    orderBy: { id: "asc" },
  })
  for (const row of listings) {
    if (!map.has(row.productId)) map.set(row.productId, row.sellingPriceCents)
  }
  return map
}

async function currentPriceForProduct(productId: string): Promise<number | null> {
  const map = await currentPricesForProducts([productId])
  return map.get(productId) ?? null
}

export async function GET(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  const guestId = userId ? null : await readGuestWishlistId()

  const url = new URL(req.url)
  const idsRaw = url.searchParams.get("ids")?.trim()
  if (idsRaw) {
    const ids = idsRaw.split(",")
    const statuses = await resolveWishlistCardStatuses(ids, { userId: userId ?? null, guestId })
    return Response.json(
      { statuses },
      { headers: { "Cache-Control": "private, no-store" } }
    )
  }

  if (!userId) {
    const productId = url.searchParams.get("productId")?.trim() || ""
    if (productId) {
      const guestWished =
        guestId && (await guestWishlistProductIds(guestId, [productId])).has(productId)
      const likeCount = await countProductLikesSingle(productId)
      return Response.json({ wished: guestWished, likeCount })
    }

    if (guestId) {
      const rows = await listGuestWishlistForDisplay(guestId)
      return Response.json({ items: rows })
    }

    return Response.json({ wished: false, items: [], statuses: {} })
  }

  const productId = url.searchParams.get("productId")?.trim() || ""
  if (productId) {
    const item = await prisma.wishlist.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { targetPriceCents: true, previousPriceCents: true, productId: true },
    })
    if (!item) {
      const likeCount = await countProductLikesSingle(productId)
      const guestWished =
        guestId && (await guestWishlistProductIds(guestId, [productId])).has(productId)
      return Response.json({ wished: guestWished, likeCount })
    }
    const current = await currentPriceForProduct(productId)
    const likeCount = await countProductLikesSingle(productId)
    return Response.json({
      wished: true,
      productId,
      likeCount,
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
  const priceMap = await currentPricesForProducts(rows.map((r) => r.productId))
  const priced = rows.map((r) => {
    const currentPriceCents = priceMap.get(r.productId) ?? null
    return {
      productId: r.productId,
      name: r.product.name,
      imageUrl: r.product.images[0] ?? null,
      targetPriceCents: r.targetPriceCents,
      currentPriceCents,
      dropPercent:
        currentPriceCents != null ? dropPercent(currentPriceCents, r.previousPriceCents) : 0,
    }
  })
  return Response.json({ items: priced })
}

export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id

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

  if (!userId) {
    const guestId = await getOrCreateGuestWishlistId()
    const result = await toggleGuestWishlist(guestId, productId)
    return Response.json(result)
  }

  const exists = await prisma.wishlist.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true },
  })

  if (exists) {
    await prisma.wishlist.delete({ where: { userId_productId: { userId, productId } } })
    const likeCount = await countProductLikesSingle(productId)
    console.log("[wishlist]", { productId, result: "unliked", likeCount })
    return Response.json({ wished: false, likeCount })
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

  const likeCount = await countProductLikesSingle(productId)
  console.log("[wishlist]", { productId, result: "liked", likeCount })
  return Response.json({ wished: true, likeCount })
}
