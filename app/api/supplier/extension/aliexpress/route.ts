import { type NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"

import { getAliExpressConfigStatus } from "@/lib/aliexpress-config"
import { AliExpressApiError, createAliExpressClient } from "@/lib/aliexpress-open-api"
import { mapAliExpressGetProductResponse } from "@/lib/aliexpress-product-map"
import {
  extensionCorsHeaders,
  requireSupplierExtensionAuth,
} from "@/lib/supplier-extension-auth"
import { defaultAffiliateCommissionPct } from "@/lib/supplier-commission"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cors(req: NextRequest, res: NextResponse): NextResponse {
  const origin = req.headers.get("origin")
  const headers = extensionCorsHeaders(origin)
  for (const [k, v] of Object.entries(headers)) {
    res.headers.set(k, v as string)
  }
  return res
}

export async function OPTIONS(req: NextRequest) {
  return cors(req, new NextResponse(null, { status: 204 }))
}

export async function POST(req: NextRequest) {
  const authResult = await requireSupplierExtensionAuth(req)
  if (authResult instanceof NextResponse) {
    return cors(req, authResult)
  }

  const body = (await req.json().catch(() => ({}))) as { productId?: string }
  const productId = typeof body.productId === "string" ? body.productId.trim() : ""
  if (!productId) {
    return cors(req, NextResponse.json({ error: "productId is required" }, { status: 400 }))
  }

  const configStatus = getAliExpressConfigStatus()
  if (!configStatus.configured) {
    return cors(
      req,
      NextResponse.json(
        {
          success: false,
          error: configStatus.message,
          missing: configStatus.missing,
        },
        { status: 503 }
      )
    )
  }

  try {
    const client = await createAliExpressClient()
    const raw = await client.getProduct(productId)
    const mapped = mapAliExpressGetProductResponse(raw, productId)

    const existing = await prisma.product.findFirst({
      where: {
        supplierId: authResult,
        aliexpressProductId: productId,
      },
      select: { id: true },
    })
    if (existing) {
      const editBase =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3001"
      return cors(
        req,
        NextResponse.json(
          {
            error: "Product already imported",
            productId: existing.id,
            editUrl: `${editBase}/dashboard/supplier/products/${existing.id}`,
          },
          { status: 409 }
        )
      )
    }

    const product = await prisma.product.create({
      data: {
        supplierId: authResult,
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

    const editBase =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3001"

    return cors(
      req,
      NextResponse.json(
        {
          success: true,
          product: { id: product.id, name: product.name },
          editUrl: `${editBase}/dashboard/supplier/products/${product.id}`,
        },
        { status: 201 }
      )
    )
  } catch (e) {
    if (!(e instanceof AliExpressApiError)) {
      Sentry.captureException(e)
    }
    const message = e instanceof Error ? e.message : "Import failed"
    const rateLimited = e instanceof AliExpressApiError && e.rateLimited
    return cors(
      req,
      NextResponse.json({ error: message, rateLimited }, { status: rateLimited ? 429 : 422 })
    )
  }
}
