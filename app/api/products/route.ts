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
      include: { supplier: true },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(products)
  }

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

  if (session.user.role !== "SUPPLIER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json()) as {
    name?: string
    description?: string
    price?: number
    priceCents?: number
    commissionPercent?: number
    image?: string
    imageUrl?: string
    stock?: number
  }

  const priceInput =
    typeof body.priceCents === "number" ? body.priceCents : body.price

  if (!body.name || typeof priceInput !== "number") {
    return NextResponse.json({ error: "Missing name or price (cents EUR)" }, { status: 400 })
  }

  const imageFromBody = body.image ?? body.imageUrl

  const product = await prisma.product.create({
    data: {
      name: body.name,
      description: body.description?.trim() || null,
      priceCents: Math.max(100, Math.round(priceInput)),
      commissionPercent: Math.min(
        90,
        Math.max(1, Math.round(body.commissionPercent ?? 30))
      ),
      image: imageFromBody?.trim() || null,
      stock: Math.max(0, Math.round(Number.isFinite(body.stock) ? Number(body.stock) : 999)),
      supplierId: session.user.id,
      active: true,
    },
  })

  return NextResponse.json(product, { status: 201 })
}
