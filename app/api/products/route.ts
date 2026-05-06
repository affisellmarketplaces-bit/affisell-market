import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const productPublicInclude = {
  supplier: { select: { email: true as const } },
} satisfies Prisma.ProductInclude

type ProductPublicRow = Prisma.ProductGetPayload<{ include: typeof productPublicInclude }>

function serializePublicProduct(p: ProductPublicRow) {
  const { supplier: sup, supplierTag, ...rest } = p
  return {
    ...rest,
    supplier: supplierTag ?? sup?.email ?? null,
    supplierEmail: sup?.email ?? null,
  }
}

function serializeMarketplaceProduct(
  p: Prisma.ProductGetPayload<{
    include: { category: { select: { name: true; slug: true } } }
  }>
) {
  return {
    id: p.id,
    name: p.name,
    title: p.name,
    price: p.basePriceCents / 100,
    basePriceCents: p.basePriceCents,
    compareAt: p.compareAt != null ? Number(p.compareAt) : null,
    image: p.images[0] ?? null,
    images: p.images,
    stock: p.stock,
    category: p.category,
    store: "Affisell" as const,
  }
}

export async function GET(request: NextRequest) {
  const categoryId = request.nextUrl.searchParams.get("categoryId")
  const subcategoryId = request.nextUrl.searchParams.get("subcategoryId")

  if (categoryId || subcategoryId) {
    const where: Prisma.ProductWhereInput = {
      active: true,
    }

    if (subcategoryId) {
      where.categoryId = subcategoryId
    } else if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        include: { subcategories: { select: { id: true } } },
      })
      if (category) {
        const ids = [category.id, ...category.subcategories.map((s) => s.id)]
        where.categoryId = { in: ids }
      }
    }

    const rows = await prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    return NextResponse.json({
      products: rows.map(serializeMarketplaceProduct),
    })
  }

  const session = await auth()

  if (session?.user?.role === "SUPPLIER") {
    const products = await prisma.product.findMany({
      where: { supplierId: session.user.id },
      orderBy: { name: "asc" },
    })
    return NextResponse.json(products)
  }

  const products = await prisma.product.findMany({
    where: { active: true },
    include: productPublicInclude,
    orderBy: { name: "asc" },
  })
  return NextResponse.json(products.map(serializePublicProduct))
}
