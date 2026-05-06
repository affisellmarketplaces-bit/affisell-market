import { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { parseProductAttributesBody } from "@/lib/supplier-product-attributes"
import { parseSupplierProductShippingBody } from "@/lib/supplier-product-shipping"
import { parseSupplierProductImages } from "@/lib/supplier-product-images"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function assertOwnProduct(supplierId: string, productId: string) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, supplierId },
    select: { id: true },
  })
  return Boolean(existing)
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const own = await assertOwnProduct(session.user.id, id)
  if (!own) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const body = (await req.json()) as {
    name?: string
    description?: string
    image?: string
    images?: unknown
    price?: number
    commission?: number
    stock?: number
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) {
    return Response.json({ error: "Missing name" }, { status: 400 })
  }

  const price = Number(body.price)
  if (!Number.isFinite(price) || price < 0) {
    return Response.json({ error: "Invalid price" }, { status: 400 })
  }

  const commission = Number(body.commission)
  const rate = Math.min(
    50,
    Math.max(1, Math.round(Number.isFinite(commission) ? commission : 20))
  )

  const stock = Math.max(0, Math.round(Number.isFinite(Number(body.stock)) ? Number(body.stock) : 0))
  const desc = typeof body.description === "string" ? body.description.trim() : ""
  const images = parseSupplierProductImages(body as unknown as Record<string, unknown>)
  const attr = parseProductAttributesBody(body as unknown as Record<string, unknown>)
  const ship = parseSupplierProductShippingBody(body as unknown as Record<string, unknown>)

  const updated = await prisma.product.update({
    where: { id },
    data: {
      name,
      description: desc,
      images,
      colorImages:
        attr.colorImages === null
          ? Prisma.DbNull
          : (attr.colorImages as unknown as Prisma.InputJsonValue),
      categories: attr.categories,
      colors: attr.colors,
      tags: attr.tags,
      variants:
        attr.variants === null
          ? Prisma.DbNull
          : (attr.variants as unknown as Prisma.InputJsonValue),
      basePriceCents: Math.max(100, Math.round(price * 100)),
      commissionRate: rate,
      stock,
      shippingCountry: ship.shippingCountry,
      warehouseType: ship.warehouseType,
      warehouseCity: ship.warehouseCity,
      processingTime: ship.processingTime,
      deliveryMin: ship.deliveryMin,
      deliveryMax: ship.deliveryMax,
      shippingMethods: ship.shippingMethods,
      freeShippingThreshold: ship.freeShippingThreshold,
      shippingCost: ship.shippingCost,
    },
  })

  return Response.json(updated)
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const own = await assertOwnProduct(session.user.id, id)
  if (!own) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const orderCount = await prisma.order.count({ where: { productId: id } })
  if (orderCount > 0) {
    return Response.json({ error: "Cannot delete a product that has orders" }, { status: 409 })
  }

  await prisma.$transaction([
    prisma.affiliateProduct.deleteMany({ where: { productId: id } }),
    prisma.product.delete({ where: { id } }),
  ])

  return new Response(null, { status: 204 })
}
