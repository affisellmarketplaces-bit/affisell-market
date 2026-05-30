import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { suggestVariantMappings } from "@/lib/fulfillment/resolve-supplier-sku"
import { resolveSupplierLinkFromAeInput } from "@/lib/fulfillment/supplier-link-resolve"
import { AliExpressApiError } from "@/lib/aliexpress-open-api"
import { prisma } from "@/lib/prisma"

const bodySchema = z.object({
  aeUrl: z.string().min(4).optional(),
})

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id: productId } = await ctx.params
  const body = bodySchema.parse(await req.json().catch(() => ({})))

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      sourceUrl: true,
      aliexpressProductId: true,
      supplierLink: { select: { aeUrl: true, aeProductId: true } },
      productVariants: { select: { id: true, color: true, size: true } },
    },
  })

  if (!product) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 })
  }

  const aeInput =
    body.aeUrl?.trim() ||
    product.supplierLink?.aeUrl ||
    product.sourceUrl ||
    (product.aliexpressProductId
      ? `https://www.aliexpress.com/item/${product.aliexpressProductId}.html`
      : "")

  if (!aeInput) {
    return NextResponse.json({ error: "ae_url_required" }, { status: 400 })
  }

  try {
    const resolved = await resolveSupplierLinkFromAeInput(aeInput)
    const aeSkus = resolved.aeSkus ?? []
    const suggestions = suggestVariantMappings(product.productVariants, aeSkus)

    console.log("[admin-sync-ae-skus]", {
      productId,
      aeProductId: resolved.aeProductId,
      skuCount: aeSkus.length,
      suggestionCount: suggestions.length,
    })

    return NextResponse.json({
      ok: true,
      resolved: {
        aeProductId: resolved.aeProductId,
        aeShopId: resolved.aeShopId,
        aeUrl: resolved.aeUrl,
        aeSkuId: resolved.aeSkuId,
        aePriceCents: resolved.aePriceCents,
        aeShippingCents: resolved.aeShippingCents,
      },
      aeSkus,
      suggestions,
    })
  } catch (e) {
    const message =
      e instanceof AliExpressApiError ? e.message : e instanceof Error ? e.message : "sync_failed"
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
