import { type NextRequest, NextResponse } from "next/server"

import {
  extensionCorsHeaders,
  requireSupplierExtensionAuth,
} from "@/lib/supplier-extension-auth"
import { mapScrapedProductForImportSave } from "@/lib/map-extension-import-product"
import {
  executeSupplierProductsImport,
  SUPPLIER_IMPORT_MAX_BATCH,
} from "@/lib/supplier-products-import-exec"

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

  const body = (await req.json().catch(() => ({}))) as {
    product?: Record<string, unknown>
    products?: unknown[]
  }

  let productsRaw: unknown[] = []
  if (body.product && typeof body.product === "object") {
    productsRaw = [mapScrapedProductForImportSave(body.product)]
  } else if (Array.isArray(body.products)) {
    productsRaw = body.products
      .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === "object"))
      .map((p) => mapScrapedProductForImportSave(p))
  }

  if (productsRaw.length === 0) {
    return cors(
      req,
      NextResponse.json({ error: "product or products required" }, { status: 400 })
    )
  }

  if (productsRaw.length > SUPPLIER_IMPORT_MAX_BATCH) {
    return cors(
      req,
      NextResponse.json(
        { error: `At most ${SUPPLIER_IMPORT_MAX_BATCH} products per request` },
        { status: 400 }
      )
    )
  }

  const result = await executeSupplierProductsImport({
    supplierId: authResult,
    productsRaw,
    bodyDraft: true,
  })

  if (!result.ok) {
    return cors(req, NextResponse.json({ error: result.error }, { status: result.status }))
  }

  const editBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3001"

  return cors(
    req,
    NextResponse.json({
      success: true,
      count: result.createdCount,
      products: result.products,
      editUrls: result.products.map(
        (p) => `${editBase}/dashboard/supplier/products/${p.id}`
      ),
    })
  )
}
