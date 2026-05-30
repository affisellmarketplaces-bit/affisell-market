import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import { prisma } from "@/lib/prisma"

const patchSchema = z.object({
  aeUrl: z.string().min(8).optional(),
  aeProductId: z.string().min(10).optional(),
  aeSkuId: z.string().nullable().optional(),
  aeShopId: z.string().optional(),
  aePriceCents: z.number().int().min(0).optional(),
  aeShippingCents: z.number().int().min(0).optional(),
  autoBuyEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
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
  const link = await prisma.supplierLink.findUnique({ where: { productId: id } })
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

  const link = await prisma.supplierLink.upsert({
    where: { productId },
    create: {
      productId,
      aeProductId: aeProductId ?? "",
      aeSkuId: body.aeSkuId ?? null,
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
      ...(body.aeSkuId !== undefined ? { aeSkuId: body.aeSkuId } : {}),
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
        ...(body.aeSkuId !== undefined ? { sourceSkuId: body.aeSkuId } : {}),
        ...(body.autoBuyEnabled !== undefined ? { autoFulfill: body.autoBuyEnabled } : {}),
      },
    })
  }

  console.log("[admin-supplier-link]", { productId, aeProductId: link.aeProductId })

  return NextResponse.json({ link })
}
