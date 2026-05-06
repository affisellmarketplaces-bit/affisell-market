import { Prisma } from "@prisma/client"
import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"
import { createNewDropCommunityPost } from "@/lib/community-new-drop"
import {
  type ProductVariantLine,
  type ProductVariantsJson,
  newVariantRowId,
} from "@/lib/product-variants"
import { prisma } from "@/lib/prisma"
import {
  parseProductCategories,
  parseProductTags,
} from "@/lib/supplier-product-attributes"
import { parseSupplierProductImages } from "@/lib/supplier-product-images"
import { parseSupplierProductShippingBody } from "@/lib/supplier-product-shipping"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BATCH = 30

function variantSkuSlug(name: string, index: number, baseSku: string): string {
  const slug =
    name
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "")
      .slice(0, 28) || `v${index}`
  return `${baseSku}-${slug}`.slice(0, 80)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const productsRaw = body.products
  if (!Array.isArray(productsRaw) || productsRaw.length === 0) {
    return NextResponse.json(
      { error: "products array required" },
      { status: 400 }
    )
  }

  if (productsRaw.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `At most ${MAX_BATCH} products per request` },
      { status: 400 }
    )
  }

  const supplierId = session.user.id

  const supplierStore = await prisma.store.findUnique({
    where: { userId: supplierId },
    select: { id: true },
  })

  const ship = parseSupplierProductShippingBody({})
  const createdIds: string[] = []

  for (const raw of productsRaw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue
    const p = raw as Record<string, unknown>

    const nameStr = typeof p.title === "string" ? p.title.trim() : ""
    if (!nameStr) continue

    const suggestedEur = Number(p.suggested_price)
    const costEur = Number(p.price)
    const priceEur = Number.isFinite(suggestedEur)
      ? suggestedEur
      : Number.isFinite(costEur)
        ? costEur * 1.5
        : 0
    const basePriceCents = Math.max(100, Math.round(priceEur * 100))

    const commRaw = Number(p.suggested_commission)
    const commissionRate = Math.min(
      50,
      Math.max(1, Math.round(Number.isFinite(commRaw) ? commRaw : 20))
    )

    const stockN = Math.max(
      0,
      Math.round(Number.isFinite(Number(p.stock)) ? Number(p.stock) : 0)
    )

    const images = parseSupplierProductImages(p)

    const categoryStr =
      typeof p.category === "string" ? p.category.trim() : ""
    const categories = parseProductCategories(
      categoryStr ? [categoryStr] : []
    )
    const tags = parseProductTags(["imported"])

    let desc = typeof p.description === "string" ? p.description.trim() : ""
    const src =
      typeof p.source_url === "string" ? p.source_url.trim() : ""
    if (src) {
      desc = desc ? `${desc}\n\nImported from ${src}` : `Imported from ${src}`
    }
    if (!desc) desc = "—"

    const baseSku =
      typeof p.sku === "string" && p.sku.trim()
        ? p.sku.trim().slice(0, 80)
        : `imp-${Date.now().toString(36)}`

    const variantInputs = Array.isArray(p.variants) ? p.variants : []
    let variantsJson: ProductVariantsJson | null = null

    if (variantInputs.length > 0) {
      const variantRows = variantInputs
        .map((v, index) => {
          if (!v || typeof v !== "object" || Array.isArray(v)) return null
          const row = v as Record<string, unknown>
          const vname =
            typeof row.name === "string" ? row.name.trim().slice(0, 160) : ""
          if (!vname) return null
          const vPriceEur = Number(row.price)
          const lineEur = Number.isFinite(vPriceEur)
            ? vPriceEur
            : priceEur
          const vStock = Math.max(
            0,
            Math.round(
              Number.isFinite(Number(row.stock)) ? Number(row.stock) : stockN
            )
          )
          const vimg =
            typeof row.image === "string" ? row.image.trim().slice(0, 2000) : ""
          const line: ProductVariantLine = {
            id: newVariantRowId(),
            name: vname,
            sku: variantSkuSlug(vname, index, baseSku),
            priceCents: Math.max(0, Math.round(lineEur * 100)),
            stock: vStock,
            commission: commissionRate,
            sales: 0,
          }
          if (vimg) line.image = vimg
          return line
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .slice(0, 500)

      if (variantRows.length > 0) variantsJson = { variantRows }
    }

    const product = await prisma.product.create({
      data: {
        supplierId,
        name: nameStr.slice(0, 500),
        description: desc.slice(0, 8000),
        images,
        colorImages: Prisma.DbNull,
        categories,
        colors: [],
        tags,
        variants:
          variantsJson === null
            ? Prisma.DbNull
            : (variantsJson as unknown as Prisma.InputJsonValue),
        basePriceCents,
        commissionRate,
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

    createdIds.push(product.id)

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
  }

  if (createdIds.length === 0) {
    return NextResponse.json(
      { error: "No valid products to create" },
      { status: 400 }
    )
  }

  return NextResponse.json({ success: true, count: createdIds.length })
}
