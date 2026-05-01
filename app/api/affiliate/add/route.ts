import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as { productId?: string }
  if (!body.productId?.trim()) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 })
  }

  const product = await prisma.product.findFirst({
    where: { id: body.productId, active: true },
  })
  if (!product) {
    return NextResponse.json({ error: "Product not found or inactive" }, { status: 404 })
  }

  const row = await prisma.affiliateProduct.upsert({
    where: {
      affiliateId_productId: {
        affiliateId: session.user.id,
        productId: product.id,
      },
    },
    create: {
      affiliateId: session.user.id,
      productId: product.id,
    },
    update: {},
  })

  return NextResponse.json(row, { status: 201 })
}
