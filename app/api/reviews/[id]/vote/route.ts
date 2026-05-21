import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"
import { capturePosthog } from "@/lib/analytics/posthog"
import { revalidateProductReviews } from "@/lib/reviews/revalidate"
import { voteReviewSchema } from "@/lib/reviews/schemas"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: reviewId } = await context.params
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = voteReviewSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid vote" }, { status: 400 })
  }

  const review = await prisma.review.findFirst({
    where: { id: reviewId, status: "PUBLISHED" },
    select: { id: true, productId: true },
  })
  if (!review) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.reviewVote.upsert({
      where: { reviewId_userId: { reviewId, userId: session.user.id } },
      create: { reviewId, userId: session.user.id, type: parsed.data.type },
      update: { type: parsed.data.type },
    })

    const helpfulCount = await tx.reviewVote.count({
      where: { reviewId, type: "HELPFUL" },
    })
    await tx.review.update({
      where: { id: reviewId },
      data: { helpfulCount },
    })
  })

  revalidateProductReviews(review.productId)

  capturePosthog(
    "review_helpful_click",
    { reviewId, type: parsed.data.type },
    session.user.id
  )

  const updated = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { helpfulCount: true },
  })

  return NextResponse.json({ helpfulCount: updated?.helpfulCount ?? 0 })
}
