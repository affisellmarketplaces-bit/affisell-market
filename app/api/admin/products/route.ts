import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import { generateAffisellSku, generateVariantSku } from "@/lib/sku/generate"
import { colorSizeFromAttributes, isVariantMappingRecord } from "@/lib/sku/variant-mapping"
import { prisma } from "@/lib/prisma"

const variantRowSchema = z.object({
  attributes: z.record(z.string(), z.string()),
  wholesalePriceCents: z.number().int().min(0).optional(),
  supplierSku: z.string().nullable().optional(),
})

const createSchema = z.object({
  name: z.string().min(2).max(200),
  supplierId: z.string().min(1),
  supplierUrl: z.string().url(),
  supplierSku: z.string().nullable().optional(),
  wholesalePriceCents: z.number().int().min(0),
  variantMapping: z.record(z.string(), z.string()).optional(),
  autoBuyEnabled: z.boolean().default(false),
  variants: z.array(variantRowSchema).optional(),
})

export async function GET() {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const suppliers = await prisma.user.findMany({
    where: { role: "SUPPLIER" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 200,
  })

  return NextResponse.json({ suppliers })
}

export async function POST(req: Request) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = createSchema.parse(await req.json())
  const supplier = await prisma.user.findFirst({
    where: { id: body.supplierId, role: "SUPPLIER" },
    select: { id: true },
  })
  if (!supplier) {
    return NextResponse.json({ error: "supplier_not_found" }, { status: 404 })
  }

  const variantMapping =
    body.variantMapping && isVariantMappingRecord(body.variantMapping)
      ? body.variantMapping
      : undefined

  const affisellSku = await generateAffisellSku()
  const wholesaleDec = new Prisma.Decimal(body.wholesalePriceCents / 100)
  const publicDec = new Prisma.Decimal(Math.round(body.wholesalePriceCents * 1.35) / 100)
  const variants = body.variants ?? []
  const hasVariants = variants.length > 0

  const aeProductId = parseAliExpressProductId(body.supplierUrl)
  if (!aeProductId) {
    return NextResponse.json({ error: "invalid_aliexpress_url" }, { status: 400 })
  }

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        supplierId: body.supplierId,
        name: body.name.trim(),
        description: `Produit auto-buy AE — ${body.name.trim()}`,
        categories: ["Auto-buy"],
        basePriceCents: Math.max(body.wholesalePriceCents, Math.round(body.wholesalePriceCents * 1.35)),
        commissionRate: 10,
        stock: 999,
        active: false,
        isDraft: true,
        importSource: "admin_ae_manual",
        sourceUrl: body.supplierUrl.trim(),
        aliexpressProductId: aeProductId,
        affisellSku,
        variantMapping: variantMapping ?? undefined,
        autoBuyEnabled: body.autoBuyEnabled,
        autoFulfill: body.autoBuyEnabled,
        supplierSku: body.supplierSku?.trim() || null,
        supplierWholesaleCents: body.wholesalePriceCents,
        hasVariants,
      },
    })

    const variantRows: Array<{ id: string; sku: string }> = []
    if (hasVariants) {
      for (const row of variants) {
        const { color, size } = colorSizeFromAttributes(row.attributes)
        const sku = generateVariantSku(affisellSku, row.attributes)
        const rowWholesale = row.wholesalePriceCents ?? body.wholesalePriceCents
        const pv = await tx.productVariant.create({
          data: {
            productId: created.id,
            sku,
            attributes: row.attributes,
            supplierSku: row.supplierSku?.trim() || null,
            color,
            size,
            wholesalePriceCents: rowWholesale,
            supplierPrice: new Prisma.Decimal(rowWholesale / 100),
            publicPrice: new Prisma.Decimal(Math.round(rowWholesale * 1.35) / 100),
            stock: 999,
          },
        })
        variantRows.push({ id: pv.id, sku })
      }
    }

    const defaultAeSku =
      body.supplierSku?.trim() ||
      variants.find((v) => v.supplierSku?.trim())?.supplierSku?.trim() ||
      null

    await tx.supplierLink.upsert({
      where: { productId: created.id },
      create: {
        productId: created.id,
        aeUrl: body.supplierUrl.trim(),
        aeProductId,
        aeSkuId: defaultAeSku,
        aeShopId: "",
        aePriceCents: body.wholesalePriceCents,
        aeShippingCents: 0,
        autoBuyEnabled: body.autoBuyEnabled,
        isActive: true,
      },
      update: {
        aeUrl: body.supplierUrl.trim(),
        aeProductId,
        aeSkuId: defaultAeSku,
        aePriceCents: body.wholesalePriceCents,
        autoBuyEnabled: body.autoBuyEnabled,
        isActive: true,
      },
    })

    return { created, variantRows }
  })

  console.log("[admin-products-create]", {
    productId: product.created.id,
    affisellSku,
    variantCount: product.variantRows.length,
    autoBuyEnabled: body.autoBuyEnabled,
  })

  return NextResponse.json({
    ok: true,
    product: {
      id: product.created.id,
      affisellSku,
      name: product.created.name,
      variants: product.variantRows,
    },
  })
}
