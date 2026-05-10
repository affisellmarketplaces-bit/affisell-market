import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  executeSupplierProductsImport,
  SUPPLIER_IMPORT_MAX_BATCH,
} from "@/lib/supplier-products-import-exec"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

  if (productsRaw.length > SUPPLIER_IMPORT_MAX_BATCH) {
    return NextResponse.json(
      { error: `At most ${SUPPLIER_IMPORT_MAX_BATCH} products per request` },
      { status: 400 }
    )
  }

  const bodyDraft =
    typeof body.status === "string"
      ? body.status.toLowerCase() === "draft"
      : false

  const result = await executeSupplierProductsImport({
    supplierId: session.user.id,
    productsRaw,
    bodyDraft,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    success: true,
    count: result.createdCount,
    products: result.products,
  })
}
