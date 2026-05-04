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

export async function GET() {
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

