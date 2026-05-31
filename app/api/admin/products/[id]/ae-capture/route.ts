import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { storeAeCaptureSessionResult } from "@/lib/fulfillment/ae-capture-session"
import { resolveSupplierLinkFromAerPaste } from "@/lib/fulfillment/supplier-link-resolve"
import { suggestVariantMappings } from "@/lib/fulfillment/resolve-supplier-sku"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import { prisma } from "@/lib/prisma"

const bodySchema = z.object({
  aeUrl: z.string().min(4),
  aerData: z.unknown(),
  sessionId: z.string().min(4).optional(),
})

function aeCaptureCors(origin: string | null): HeadersInit {
  if (!origin) return {}
  try {
    if (!/\.aliexpress\.com$/i.test(new URL(origin).hostname)) return {}
  } catch {
    return {}
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin")
  return new NextResponse(null, { status: 204, headers: aeCaptureCors(origin) })
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const origin = req.headers.get("origin")
  const cors = aeCaptureCors(origin)

  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: cors })
  }

  const { id: productId } = await ctx.params
  const contentType = req.headers.get("content-type") ?? ""

  let body: z.infer<typeof bodySchema>
  if (contentType.includes("application/json")) {
    body = bodySchema.parse(await req.json())
  } else {
    const form = await req.formData()
    const raw = form.get("payload")
    if (typeof raw !== "string") {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400, headers: cors })
    }
    body = bodySchema.parse(JSON.parse(raw))
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      productVariants: { select: { id: true, color: true, size: true } },
    },
  })
  if (!product) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404, headers: cors })
  }

  const aeProductId = parseAliExpressProductId(body.aeUrl)
  if (!aeProductId) {
    return NextResponse.json({ error: "invalid_aliexpress_url" }, { status: 400, headers: cors })
  }

  const resolved = resolveSupplierLinkFromAerPaste(aeProductId, body.aerData, body.aeUrl)
  const aeSkus = resolved.aeSkus ?? []
  const suggestions = suggestVariantMappings(product.productVariants, aeSkus)

  const payload = {
    resolved: { ...resolved, aeSkus },
    suggestions,
  }

  if (body.sessionId) {
    await storeAeCaptureSessionResult(body.sessionId, productId, payload)
  }

  console.log("[admin-ae-capture]", {
    productId,
    aeProductId,
    skuCount: aeSkus.length,
    suggestionCount: suggestions.length,
    sessionId: body.sessionId ?? null,
  })

  const appBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://affisell.com"
  const returnUrl = `${appBase}/admin/products/${productId}?aeImported=1`

  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(returnUrl, { headers: cors })
  }

  return NextResponse.json({ ok: true, returnUrl, ...payload }, { headers: cors })
}
