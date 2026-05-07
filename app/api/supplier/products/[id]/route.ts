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
    compareAt?: number | string | null
    commission?: number
    stock?: number
    categoryId?: string | null
    productAttributes?: Array<{ key?: unknown; label?: unknown; value?: unknown }>
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) {
    return Response.json({ error: "Missing name" }, { status: 400 })
  }

  const price = Number(body.price)
  if (!Number.isFinite(price) || price < 0) {
    return Response.json({ error: "Invalid price" }, { status: 400 })
  }
  const priceCents = Math.max(100, Math.round(price * 100))

  let compareAt: Prisma.Decimal | null = null
  if (body.compareAt != null && String(body.compareAt).trim() !== "") {
    const compareAtNumber = Number(body.compareAt)
    if (!Number.isFinite(compareAtNumber) || compareAtNumber <= 0) {
      return Response.json({ error: "Invalid compare-at price" }, { status: 400 })
    }
    const compareAtCents = Math.round(compareAtNumber * 100)
    if (compareAtCents <= priceCents) {
      return Response.json({ error: "Compare-at price must be greater than price" }, { status: 400 })
    }
    const discountPct = ((compareAtCents - priceCents) / compareAtCents) * 100
    if (discountPct > 70) {
      return Response.json({ error: "Discount cannot exceed 70%" }, { status: 400 })
    }
    compareAt = new Prisma.Decimal(compareAtNumber.toFixed(2))
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
  const categoryId =
    typeof body.categoryId === "string" && body.categoryId.trim().length ? body.categoryId.trim() : null
  const productAttributes = Array.isArray(body.productAttributes)
    ? body.productAttributes
        .map((row) => (row && typeof row === "object" ? (row as Record<string, unknown>) : null))
        .filter((row): row is Record<string, unknown> => row != null)
        .map((row) => ({
          key: String(row.key ?? "").trim(),
          label: String(row.label ?? row.key ?? "").trim(),
          value: String(row.value ?? "").trim(),
        }))
        .filter((r) => r.key.length > 0 && r.value.length > 0)
    : []

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.product.update({
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
        basePriceCents: priceCents,
        compareAt,
        commissionRate: rate,
        stock,
        categoryId,
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

    await tx.productAttribute.deleteMany({ where: { productId: id } })
    if (productAttributes.length) {
      await tx.productAttribute.createMany({
        data: productAttributes.map((a) => ({
          productId: id,
          key: a.key,
          label: a.label || a.key,
          value: a.value,
        })),
      })
    }
    return p
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
