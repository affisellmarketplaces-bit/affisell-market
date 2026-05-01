import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
    include: {
      supplier: { select: { email: true } },
    },
    orderBy: { name: "asc" },
  })
  return NextResponse.json(products)
}

