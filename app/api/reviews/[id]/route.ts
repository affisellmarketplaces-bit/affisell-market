import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"
import { revalidateProductReviews } from "@/lib/reviews/revalidate"
import { recomputeProductReviewStats } from "@/lib/reviews/stats"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GDPR: buyer anonymizes their review (soft delete). */
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const review = await prisma.review.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, productId: true, orderId: true },
  })
  if (!review) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.reviewVote.deleteMany({ where: { reviewId: id } })
    await tx.reviewReply.deleteMany({ where: { reviewId: id } })
    await tx.review.update({
      where: { id },
      data: {
        status: "REJECTED",
        body: "[Review removed by user]",
        title: null,
        media: [],
        images: [],
        author: "Anonymous",
        userId: null,
        moderationNote: "gdpr_user_delete",
      },
    })
    await recomputeProductReviewStats(review.productId)
  })

  revalidateProductReviews(review.productId)

  return NextResponse.json({ ok: true })
}
