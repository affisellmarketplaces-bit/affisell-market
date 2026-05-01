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

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json()) as {
    name?: string
    description?: string
    basePrice?: number
    basePriceCents?: number
    commissionRate?: number
    image?: string
    imageUrl?: string
  }

  const cents =
    typeof body.basePriceCents === "number"
      ? Math.round(body.basePriceCents)
      : typeof body.basePrice === "number"
        ? Math.round(body.basePrice * 100)
        : NaN

  if (!body.name?.trim() || !Number.isFinite(cents)) {
    return NextResponse.json({ error: "Missing name or base price (EUR)" }, { status: 400 })
  }

  const imageRaw = body.image ?? body.imageUrl ?? ""
  const commissionRate = Math.min(
    99,
    Math.max(1, Math.round(Number.isFinite(body.commissionRate ?? NaN) ? body.commissionRate! : 20))
  )

  const product = await prisma.product.create({
    data: {
      supplierId: session.user.id,
      name: body.name.trim(),
      description: (body.description ?? "").trim(),
      image: imageRaw.trim() || "https://placehold.co/600x600?text=Product",
      basePriceCents: Math.max(100, cents),
      commissionRate,
      active: true,
    },
  })

  return NextResponse.json(product, { status: 201 })
}
