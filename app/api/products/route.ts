import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const products = await prisma.product.findMany({
    where: { active: true },
    include: { supplier: true },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(products)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json()) as {
    name?: string
    description?: string
    price?: number
    commissionPercent?: number
    imageUrl?: string
  }

  if (!body.name || typeof body.price !== "number") {
    return NextResponse.json(
      { error: "name et price sont requis" },
      { status: 400 }
    )
  }

  const product = await prisma.product.create({
    data: {
      name: body.name,
      description: body.description?.trim() || null,
      price: Math.max(100, Math.round(body.price)),
      commissionPercent: Math.min(
        90,
        Math.max(1, Math.round(body.commissionPercent ?? 30))
      ),
      imageUrl: body.imageUrl?.trim() || null,
      supplierId: session.user.id,
      active: true,
    },
  })

  return NextResponse.json(product, { status: 201 })
}
