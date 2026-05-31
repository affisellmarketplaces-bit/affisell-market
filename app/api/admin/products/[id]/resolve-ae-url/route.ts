import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { resolveSupplierLinkFromAeInput } from "@/lib/fulfillment/supplier-link-resolve"
import { suggestVariantMappings } from "@/lib/fulfillment/resolve-supplier-sku"
import { AliExpressApiError } from "@/lib/aliexpress-open-api"
import { prisma } from "@/lib/prisma"

const bodySchema = z.object({
  aeUrl: z.string().min(4),
  /** JSON collé depuis `window.__AER_DATA__` dans la console AE */
  aerDataPaste: z.unknown().optional(),
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
  const body = bodySchema.parse(await req.json())

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      productVariants: { select: { id: true, color: true, size: true } },
    },
  })

  try {
    const resolved = await resolveSupplierLinkFromAeInput(body.aeUrl, {
      aerDataPaste: body.aerDataPaste,
    })
    const aeSkus = resolved.aeSkus ?? []
    const suggestions =
      product && aeSkus.length > 0
        ? suggestVariantMappings(product.productVariants, aeSkus)
        : []

    console.log("[admin-resolve-ae-url]", {
      productId,
      source: resolved.source ?? "unknown",
      skuCount: aeSkus.length,
      suggestionCount: suggestions.length,
    })

    return NextResponse.json({
      ok: true,
      resolved: {
        ...resolved,
        aeSkus,
      },
      suggestions,
    })
  } catch (e) {
    const message = e instanceof AliExpressApiError ? e.message : e instanceof Error ? e.message : "resolve_failed"
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
