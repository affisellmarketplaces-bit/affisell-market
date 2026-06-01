import { NextResponse } from "next/server"
import { z } from "zod"

import { replaceSupplierLinkVariants } from "@/lib/admin/products/upsert-supplier-link-variants"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { isValidAeSkuId, normalizeAeSkuCandidate } from "@/lib/fulfillment/map-catalog-skus-to-ae"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import { prisma } from "@/lib/prisma"

const variantMappingSchema = z.object({
  productVariantId: z.string().nullable().optional(),
  matchColor: z.string().nullable().optional(),
  matchSize: z.string().nullable().optional(),
  aeSkuId: z
    .string()
    .min(1)
    .refine((v) => isValidAeSkuId(v), {
      message: "SKU AE invalide — attendu un identifiant numérique AliExpress (10–22 chiffres).",
    }),
  aePriceCents: z.number().int().min(0),
  aeShippingCents: z.number().int().min(0).optional(),
  aeLabel: z.string().nullable().optional(),
})

const patchSchema = z.object({
  aeUrl: z.string().min(8).optional(),
  aeProductId: z.string().min(10).optional(),
  aeSkuId: z.string().nullable().optional(),
  aeShopId: z.string().optional(),
  aePriceCents: z.number().int().min(0).optional(),
  aeShippingCents: z.number().int().min(0).optional(),
  autoBuyEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
  variantMappings: z.array(variantMappingSchema).optional(),
})

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await ctx.params
  const link = await prisma.supplierLink.findUnique({
    where: { productId: id },
    include: {
      variantMappings: {
        include: {
          productVariant: { select: { id: true, color: true, size: true, sku: true } },
        },
        orderBy: { aeLabel: "asc" },
      },
    },
  })
  return NextResponse.json({ link })
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id: productId } = await ctx.params
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  })
  if (!product) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 })
  }

  const body = patchSchema.parse(await req.json())
  const aeProductId =
    body.aeProductId?.trim() ||
    (body.aeUrl ? parseAliExpressProductId(body.aeUrl) : null) ||
    undefined

  if (!aeProductId && !body.aeUrl) {
    return NextResponse.json({ error: "aeProductId_or_aeUrl_required" }, { status: 400 })
  }

  const aeUrl =
    body.aeUrl?.trim() ||
    (aeProductId ? `https://www.aliexpress.com/item/${aeProductId}.html` : "")

  const normalizedDefaultAeSkuId =
    body.aeSkuId !== undefined && body.aeSkuId !== null
      ? normalizeAeSkuCandidate(body.aeSkuId) || null
      : undefined

  const link = await prisma.supplierLink.upsert({
    where: { productId },
    create: {
      productId,
      aeProductId: aeProductId ?? "",
      aeSkuId: normalizedDefaultAeSkuId ?? null,
      aeShopId: body.aeShopId ?? "",
      aePriceCents: body.aePriceCents ?? 0,
      aeShippingCents: body.aeShippingCents ?? 0,
      aeUrl,
      autoBuyEnabled: body.autoBuyEnabled ?? true,
      isActive: body.isActive ?? true,
      lastSyncAt: new Date(),
    },
    update: {
      ...(aeProductId ? { aeProductId } : {}),
      ...(normalizedDefaultAeSkuId !== undefined ? { aeSkuId: normalizedDefaultAeSkuId } : {}),
      ...(body.aeShopId !== undefined ? { aeShopId: body.aeShopId } : {}),
      ...(body.aePriceCents !== undefined ? { aePriceCents: body.aePriceCents } : {}),
      ...(body.aeShippingCents !== undefined ? { aeShippingCents: body.aeShippingCents } : {}),
      ...(aeUrl ? { aeUrl } : {}),
      ...(body.autoBuyEnabled !== undefined ? { autoBuyEnabled: body.autoBuyEnabled } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      lastSyncAt: new Date(),
    },
  })

  if (aeProductId) {
    await prisma.product.update({
      where: { id: productId },
      data: {
        aliexpressProductId: aeProductId,
        importSource: "aliexpress",
        sourceUrl: aeUrl,
        ...(normalizedDefaultAeSkuId !== undefined
          ? { sourceSkuId: normalizedDefaultAeSkuId }
          : {}),
        ...(body.autoBuyEnabled !== undefined ? { autoFulfill: body.autoBuyEnabled } : {}),
      },
    })
  }

  if (body.variantMappings !== undefined) {
    await replaceSupplierLinkVariants(prisma, link.id, body.variantMappings)
  }

  const linkWithVariants = await prisma.supplierLink.findUnique({
    where: { id: link.id },
    include: {
      variantMappings: {
        include: {
          productVariant: { select: { id: true, color: true, size: true, sku: true } },
        },
        orderBy: { aeLabel: "asc" },
      },
    },
  })

  console.log("[admin-supplier-link]", {
    productId,
    aeProductId: link.aeProductId,
    variantMappingCount: body.variantMappings?.length ?? null,
  })

  return NextResponse.json({ link: linkWithVariants ?? link })
}
