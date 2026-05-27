import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  extractMaterialAndDimensions,
  generateProductDescriptionWithGpt4o,
  resolveSupplierPriceEur,
} from "@/lib/affiliate-product-generate-description"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function canGenerateForProduct(
  productId: string,
  userId: string,
  role: string
): Promise<boolean> {
  if (role === "ADMIN") return true

  if (role === "SUPPLIER") {
    const owned = await prisma.product.findFirst({
      where: { id: productId, supplierId: userId },
      select: { id: true },
    })
    return Boolean(owned)
  }

  if (role === "AFFILIATE") {
    const listing = await prisma.affiliateProduct.findFirst({
      where: { productId, affiliateId: userId },
      select: { id: true },
    })
    return Boolean(listing)
  }

  return false
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const role = String((session.user as { role?: string }).role ?? "").toUpperCase()
  if (role !== "AFFILIATE" && role !== "SUPPLIER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "IA indisponible (OPENAI_API_KEY manquante)." },
      { status: 503 }
    )
  }

  const { id: productId } = await ctx.params

  const allowed = await canGenerateForProduct(productId, session.user.id, role)
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      images: true,
      basePriceCents: true,
      category: { select: { fullPath: true, name: true } },
      attributes: { select: { key: true, label: true, value: true } },
      productVariants: {
        select: { supplierPrice: true },
        orderBy: { createdAt: "asc" },
        take: 8,
      },
    },
  })

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  const { material, dimensions, extra } = extractMaterialAndDimensions(product.attributes)
  const categoryPath =
    product.category?.fullPath?.trim() || product.category?.name?.trim() || undefined

  try {
    const result = await generateProductDescriptionWithGpt4o({
      name: product.name,
      supplierPriceEur: resolveSupplierPriceEur(product),
      images: product.images.filter(Boolean).slice(0, 6),
      specs: { material, dimensions, extra },
      categoryPath,
    })

    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Génération impossible" },
      { status: 502 }
    )
  }
}
