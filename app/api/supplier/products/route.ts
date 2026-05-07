import { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { createNewDropCommunityPost } from "@/lib/community-new-drop"
import { parseProductAttributesBody } from "@/lib/supplier-product-attributes"
import { parseSupplierProductShippingBody } from "@/lib/supplier-product-shipping"
import { parseSupplierProductImages } from "@/lib/supplier-product-images"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }
  const products = await prisma.product.findMany({
    where: { supplierId: session.user.id },
    orderBy: { name: "asc" },
  })
  return Response.json(
    products.map((p) => ({
      ...p,
      compareAt: p.compareAt != null ? Number(p.compareAt) : null,
      freeShippingThreshold:
        p.freeShippingThreshold != null ? Number(p.freeShippingThreshold) : null,
      shippingCost: Number(p.shippingCost),
    }))
  )
}

export async function POST(req: Request) {
  const session = await auth()

  if (!session?.user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden - not supplier" }, { status: 403 })
  }

  const body = await req.json()
  const {
    name,
    basePriceCents: basePriceCentsRaw,
    compareAt: compareAtRaw,
    commissionRate,
    commission,
    description,
    price,
    stock,
  } = body as Record<string, unknown>
  const categoryIdRaw = (body as Record<string, unknown>).categoryId
  const categoryId = typeof categoryIdRaw === "string" ? categoryIdRaw.trim() : ""
  const productAttributesRaw = (body as Record<string, unknown>).productAttributes

  const nameStr = typeof name === "string" ? name.trim() : ""
  if (!nameStr) {
    return Response.json({ error: "Missing name" }, { status: 400 })
  }

  let cents: number
  if (Number.isFinite(Number(price))) {
    cents = Math.round(Number(price) * 100)
  } else if (basePriceCentsRaw != null) {
    cents = Math.round(Number(basePriceCentsRaw))
  } else {
    return Response.json({ error: "Missing price" }, { status: 400 })
  }
  const normalizedPriceCents = Math.max(100, cents)
  let compareAt: Prisma.Decimal | null = null
  if (compareAtRaw != null && String(compareAtRaw).trim() !== "") {
    const compareAtNumber = Number(compareAtRaw)
    if (!Number.isFinite(compareAtNumber) || compareAtNumber <= 0) {
      return Response.json({ error: "Invalid compare-at price" }, { status: 400 })
    }
    const compareAtCents = Math.round(compareAtNumber * 100)
    if (compareAtCents <= normalizedPriceCents) {
      return Response.json({ error: "Compare-at price must be greater than price" }, { status: 400 })
    }
    const discountPct = ((compareAtCents - normalizedPriceCents) / compareAtCents) * 100
    if (discountPct > 70) {
      return Response.json({ error: "Discount cannot exceed 70%" }, { status: 400 })
    }
    compareAt = new Prisma.Decimal(compareAtNumber.toFixed(2))
  }

  const commRaw = commission ?? commissionRate
  const rate = Math.min(
    50,
    Math.max(1, Math.round(Number.isFinite(Number(commRaw)) ? Number(commRaw) : 20))
  )
  const images = parseSupplierProductImages(body as Record<string, unknown>)
  const attr = parseProductAttributesBody(body as Record<string, unknown>)
  const ship = parseSupplierProductShippingBody(body as Record<string, unknown>)
  const desc = typeof description === "string" ? description.trim() : ""
  const stockN = Math.max(0, Math.round(Number.isFinite(Number(stock)) ? Number(stock) : 0))

  const productAttributes = Array.isArray(productAttributesRaw)
    ? productAttributesRaw
        .map((row) => (row && typeof row === "object" ? (row as Record<string, unknown>) : null))
        .filter((row): row is Record<string, unknown> => row != null)
        .map((row) => ({
          key: String(row.key ?? "").trim(),
          label: String(row.label ?? row.key ?? "").trim(),
          value: String(row.value ?? "").trim(),
        }))
        .filter((r) => r.key.length > 0 && r.value.length > 0)
    : []

  const supplierId = (session.user as { id: string }).id

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        supplierId,
        name: nameStr,
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
        basePriceCents: normalizedPriceCents,
        compareAt,
        commissionRate: rate,
        stock: stockN,
        active: true,
        categoryId: categoryId || null,
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

    if (productAttributes.length) {
      await tx.productAttribute.createMany({
        data: productAttributes.map((a) => ({
          productId: created.id,
          key: a.key,
          label: a.label || a.key,
          value: a.value,
        })),
        skipDuplicates: true,
      })
    }

    return created
  })

  const supplierStore = await prisma.store.findUnique({
    where: { userId: (session.user as { id: string }).id },
    select: { id: true },
  })
  if (supplierStore) {
    try {
      await createNewDropCommunityPost({
        storeId: supplierStore.id,
        productId: product.id,
        productName: product.name,
      })
    } catch {
      /* non-fatal */
    }
  }

  return Response.json(product, { status: 201 })
}
