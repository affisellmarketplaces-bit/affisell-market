import * as Sentry from "@sentry/nextjs"

import { AliExpressApiError, AliExpressClient } from "@/lib/aliexpress-open-api"
import { mapAliExpressGetProductResponse } from "@/lib/aliexpress-product-map"
import { defaultAffiliateCommissionPct } from "@/lib/supplier-commission"
import { requireSupplierOrAdminSession } from "@/lib/supplier-or-admin-session"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await requireSupplierOrAdminSession()
  if (!session?.user?.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as { productId?: string }
  const productId = typeof body.productId === "string" ? body.productId.trim() : ""
  if (!productId) {
    return Response.json({ error: "productId is required" }, { status: 400 })
  }

  const client = new AliExpressClient()
  if (!client.isConfigured()) {
    return Response.json({ error: "AliExpress API is not configured" }, { status: 503 })
  }

  try {
    const raw = await client.getProduct(productId)
    const mapped = mapAliExpressGetProductResponse(raw, productId)

    const existing = await prisma.product.findFirst({
      where: {
        supplierId: session.user.id,
        aliexpressProductId: productId,
      },
      select: { id: true },
    })
    if (existing) {
      return Response.json(
        { error: "Product already imported", productId: existing.id },
        { status: 409 }
      )
    }

    const product = await prisma.product.create({
      data: {
        supplierId: session.user.id,
        name: mapped.name,
        description: mapped.description,
        images: mapped.images,
        basePriceCents: mapped.basePriceCents,
        stock: mapped.stock,
        commissionRate: defaultAffiliateCommissionPct(),
        active: false,
        isDraft: true,
        aliexpressProductId: mapped.aliexpressProductId,
        importSource: "aliexpress",
        categories: ["AliExpress"],
        supplierTag: "aliexpress",
      },
    })

    return Response.json({ success: true, product }, { status: 201 })
  } catch (e) {
    if (!(e instanceof AliExpressApiError)) {
      Sentry.captureException(e)
    }
    const message = e instanceof Error ? e.message : "Import failed"
    const rateLimited = e instanceof AliExpressApiError && e.rateLimited
    const status =
      rateLimited
        ? 429
        : e instanceof AliExpressApiError
          ? 502
          : message.includes("not found") || message.includes("no title")
            ? 422
            : 500
    return Response.json(
      {
        success: false,
        error: message,
        rateLimited,
        ...(e instanceof AliExpressApiError && e.code != null ? { code: e.code } : {}),
      },
      { status }
    )
  }
}
