import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { serializeProductVariantRow } from "@/lib/product-variant-sku"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const role = (session.user as { role?: string }).role

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      productVariants: { orderBy: { createdAt: "asc" } },
      supplier: { select: { id: true, name: true, email: true } },
    },
  })

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  const isOwner = product.supplierId === session.user.id
  const isAdmin = role === "ADMIN"
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const variants = product.productVariants.map(serializeProductVariantRow)
  const totalMargin = variants.reduce((sum, v) => sum + v.margin, 0)

  return NextResponse.json({
    id: product.id,
    name: product.name,
    hasVariants: product.hasVariants,
    basePriceCents: product.basePriceCents,
    stock: product.stock,
    commissionRate: product.commissionRate,
    active: product.active,
    isDraft: product.isDraft,
    variants,
    variantSummary: {
      count: variants.length,
      totalStock: variants.reduce((s, v) => s + v.stock, 0),
      totalMarginEur: Math.round(totalMargin * 100) / 100,
      minPublicPrice: variants.length
        ? Math.min(...variants.map((v) => v.publicPrice))
        : product.basePriceCents / 100,
      maxPublicPrice: variants.length
        ? Math.max(...variants.map((v) => v.publicPrice))
        : product.basePriceCents / 100,
    },
    supplier: product.supplier,
  })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const body = (await request.json()) as { active?: boolean }

  const existing = await prisma.product.findUnique({
    where: { id },
    select: { supplierId: true },
  })

  if (!existing) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  if (existing.supplierId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const updated = await prisma.product.update({
    where: { id },
    data: { active: Boolean(body.active) },
  })

  return NextResponse.json(updated)
}
