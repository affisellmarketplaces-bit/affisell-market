import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ReviewPayload = {
  rating?: unknown
  author?: unknown
  country?: unknown
  date?: unknown
  text?: unknown
  images?: unknown
  variant?: unknown
  helpful_count?: unknown
  verified?: unknown
  sentiment?: unknown
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: productId } = await context.params

  const own = await prisma.product.findFirst({
    where: { id: productId, supplierId: session.user.id },
    select: { id: true },
  })
  if (!own) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = (await req.json()) as { reviews?: unknown }
  const rawReviews = Array.isArray(body.reviews) ? body.reviews : []

  const rows = rawReviews
    .map((raw) => raw as ReviewPayload)
    .map((r) => {
      const rating = Math.max(
        1,
        Math.min(5, Math.round(Number(r.rating ?? 5) || 5))
      )
      const author =
        typeof r.author === "string" && r.author.trim()
          ? r.author.trim().slice(0, 120)
          : "Anonymous"
      const country =
        typeof r.country === "string" && r.country.trim()
          ? r.country.trim().slice(0, 80)
          : null
      const dt = new Date(
        typeof r.date === "string" && r.date.trim()
          ? r.date
          : Date.now()
      )
      const date = Number.isFinite(dt.getTime()) ? dt : new Date()
      const text =
        typeof r.text === "string" ? r.text.trim().slice(0, 12000) : ""
      const images = Array.isArray(r.images)
        ? r.images
            .filter((u): u is string => typeof u === "string" && Boolean(u.trim()))
            .map((u) => u.trim().slice(0, 2000))
            .slice(0, 8)
        : []
      const variant =
        typeof r.variant === "string" && r.variant.trim()
          ? r.variant.trim().slice(0, 300)
          : null
      const helpful_count = Math.max(
        0,
        Math.round(Number(r.helpful_count ?? 0) || 0)
      )
      const verified = r.verified !== false
      const sentiment =
        typeof r.sentiment === "string" &&
        ["positive", "neutral", "negative"].includes(r.sentiment)
          ? r.sentiment
          : rating >= 4
            ? "positive"
            : rating >= 3
              ? "neutral"
              : "negative"

      return {
        productId,
        rating,
        author,
        country,
        date,
        body: text,
        images,
        variant,
        helpfulCount: helpful_count,
        verified,
        sentiment,
        status: "PUBLISHED" as const,
        publishedAt: date,
        media: images.map((url) => ({ type: "image", url })),
      }
    })
    .filter((r) => r.body.length > 0)

  await prisma.review.deleteMany({ where: { productId } })

  if (rows.length > 0) {
    await prisma.review.createMany({ data: rows })
  }

  const avgRating =
    rows.length > 0
      ? rows.reduce((sum, r) => sum + r.rating, 0) / rows.length
      : 0
  const sentiment =
    avgRating >= 4 ? "positive" : avgRating >= 3 ? "neutral" : "negative"

  const ugcCount = rows.filter((r) => r.images.length > 0).length

  await prisma.product.update({
    where: { id: productId },
    data: {
      reviewCount: rows.length,
      averageRating: parseFloat(avgRating.toFixed(1)),
      reviewSentiment: rows.length > 0 ? sentiment : "neutral",
      ugcCount,
    },
  })

  return NextResponse.json({ success: true, imported: rows.length })
}
