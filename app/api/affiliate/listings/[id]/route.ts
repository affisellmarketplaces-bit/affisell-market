import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as {
    active?: boolean
    sellingPriceCents?: number
  }

  const row = await prisma.affiliateProduct.findUnique({
    where: { id },
    include: { product: true },
  })

  if (!row) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }

  if (row.affiliateId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const nextSelling =
    typeof body.sellingPriceCents === "number" && Number.isFinite(body.sellingPriceCents)
      ? Math.round(body.sellingPriceCents)
      : undefined

  if (nextSelling !== undefined && nextSelling < row.product.basePriceCents) {
    return NextResponse.json({ error: "Selling price cannot be below base price" }, { status: 400 })
  }

  const updated = await prisma.affiliateProduct.update({
    where: { id },
    data: {
      ...(typeof body.active === "boolean" ? { active: body.active } : {}),
      ...(nextSelling !== undefined ? { sellingPriceCents: nextSelling } : {}),
    },
  })

  return NextResponse.json(updated)
}
