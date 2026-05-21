import { unstable_cache } from "next/cache"
import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"
import { legacyImagesToMedia, parseReviewMedia } from "@/lib/reviews/media"
import { publishedReviewWhere, getRatingDistribution } from "@/lib/reviews/stats"
import { serializeReview } from "@/lib/reviews/serialize"
import type { ReviewSort, ReviewsListResponse } from "@/lib/reviews/types"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PAGE_SIZE = 12

function parseSort(raw: string | null): ReviewSort {
  if (raw === "recent" || raw === "rating_desc" || raw === "with_media") return raw
  return "top"
}

async function fetchReviewsPage(
  productId: string,
  opts: {
    sort: ReviewSort
    rating?: number
    verifiedOnly: boolean
    cursor?: string
    userId?: string | null
  }
) {
  const where = {
    ...publishedReviewWhere(productId),
    ...(opts.rating ? { rating: opts.rating } : {}),
    ...(opts.verifiedOnly ? { verified: true } : {}),
  }

  const orderBy =
    opts.sort === "recent"
      ? [{ publishedAt: "desc" as const }, { createdAt: "desc" as const }]
      : opts.sort === "rating_desc"
        ? [{ rating: "desc" as const }, { helpfulCount: "desc" as const }]
        : [{ helpfulCount: "desc" as const }, { createdAt: "desc" as const }]

  const rows = await prisma.review.findMany({
    where,
    orderBy,
    take: PAGE_SIZE + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    include: {
      user: { select: { id: true, name: true, image: true } },
      votes: opts.userId
        ? { where: { userId: opts.userId }, select: { type: true }, take: 1 }
        : { take: 0, select: { type: true } },
      reply: { include: { user: { select: { name: true, image: true } } } },
    },
  })

  let items = rows
  if (opts.sort === "with_media") {
    items = rows.filter((r) => {
      const media = parseReviewMedia(r.media)
      return media.length > 0 || r.images.length > 0
    })
  }

  const hasMore = items.length > PAGE_SIZE
  const page = hasMore ? items.slice(0, PAGE_SIZE) : items
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null

  const userIds = [...new Set(page.map((r) => r.userId).filter(Boolean))] as string[]
  const counts =
    userIds.length > 0
      ? await prisma.review.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds }, status: "PUBLISHED" },
          _count: { id: true },
        })
      : []
  const countMap = new Map(counts.map((c) => [c.userId!, c._count.id]))

  return {
    items: page.map((r) =>
      serializeReview(r, {
        myVote: r.votes[0]?.type ?? null,
        totalReviews: r.userId ? countMap.get(r.userId) ?? 0 : 0,
      })
    ),
    nextCursor,
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  const { productId } = await context.params
  const sp = req.nextUrl.searchParams
  const sort = parseSort(sp.get("sort"))
  const ratingRaw = sp.get("rating")
  const rating = ratingRaw ? Number(ratingRaw) : undefined
  const verifiedOnly = sp.get("verified") === "true"
  const cursor = sp.get("cursor") ?? undefined

  const session = await auth()

  const product = await prisma.product.findFirst({
    where: { id: productId, active: true },
    select: {
      id: true,
      averageRating: true,
      reviewCount: true,
      ugcCount: true,
    },
  })
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const cacheKey = `reviews-${productId}-${sort}-${rating ?? "all"}-${verifiedOnly}-${cursor ?? "0"}`

  const { items, nextCursor } = await unstable_cache(
    () =>
      fetchReviewsPage(productId, {
        sort,
        rating: rating && rating >= 1 && rating <= 5 ? rating : undefined,
        verifiedOnly,
        cursor,
        userId: session?.user?.id ?? null,
      }),
    [cacheKey],
    { revalidate: 60, tags: [`reviews-${productId}`] }
  )()

  const distribution = await getRatingDistribution(productId)

  const total = product.reviewCount

  const payload: ReviewsListResponse = {
    items,
    nextCursor,
    total,
    summary: {
      averageRating: product.averageRating,
      reviewCount: product.reviewCount,
      ugcCount: product.ugcCount,
      distribution,
      aiSummary: null,
    },
  }

  return NextResponse.json(payload)
}
