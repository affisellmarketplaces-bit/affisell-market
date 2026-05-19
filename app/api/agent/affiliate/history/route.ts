import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "AFFILIATE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rows = await prisma.searchHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { query: true, productId: true },
  })

  const recentQueries = rows
    .map((r) => r.query.replace(/^\[sourcing\]\s*/i, "").trim())
    .filter(Boolean)

  const productIds = [...new Set(rows.map((r) => r.productId).filter(Boolean))] as string[]
  const products =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds.slice(0, 6) }, active: true },
          select: { id: true, name: true, images: true, basePriceCents: true, commissionRate: true },
        })
      : []

  return NextResponse.json({
    recentQueries: [...new Set(recentQueries)].slice(0, 8),
    lastQuery: recentQueries[0] ?? null,
    viewedProducts: products.map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: primaryProductImage(p.images),
      basePriceCents: p.basePriceCents,
      commissionRate: Math.round(Number(p.commissionRate) || 0),
    })),
  })
}
