import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { revalidateProductReviews } from "@/lib/reviews/revalidate"
import { recomputeProductReviewStats } from "@/lib/reviews/stats"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const patchSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(50),
  action: z.enum(["approve", "reject"]),
})

export async function GET() {
  const session = await auth()
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const rows = await prisma.review.findMany({
    where: { status: { in: ["PENDING", "AI_FLAGGED"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      product: { select: { id: true, name: true } },
      user: { select: { id: true, email: true, name: true } },
    },
  })

  const flagged = await prisma.review.count({ where: { status: "AI_FLAGGED" } })
  const pending = await prisma.review.count({ where: { status: "PENDING" } })
  const avgAi = await prisma.review.aggregate({
    where: { aiScore: { not: null } },
    _avg: { aiScore: true },
  })

  return NextResponse.json({
    rows,
    stats: {
      flagged,
      pending,
      avgAiScore: avgAi._avg.aiScore,
    },
  })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = patchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const status = parsed.data.action === "approve" ? "PUBLISHED" : "REJECTED"
  const publishedAt = status === "PUBLISHED" ? new Date() : null

  const updated = await prisma.review.updateMany({
    where: { id: { in: parsed.data.ids } },
    data: { status, publishedAt },
  })

  const products = await prisma.review.findMany({
    where: { id: { in: parsed.data.ids } },
    select: { productId: true },
    distinct: ["productId"],
  })

  for (const { productId } of products) {
    await recomputeProductReviewStats(productId)
    revalidateProductReviews(productId)
  }

  return NextResponse.json({ updated: updated.count })
}
