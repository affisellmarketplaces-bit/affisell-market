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
    commissionRate,
    commission,
    description,
    price,
    stock,
  } = body as Record<string, unknown>

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

  const product = await prisma.product.create({
    data: {
      supplierId: (session.user as { id: string }).id,
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
      basePriceCents: Math.max(100, cents),
      commissionRate: rate,
      stock: stockN,
      active: true,
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
