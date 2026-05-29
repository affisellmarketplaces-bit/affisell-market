import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { runProductImportAgent } from "@/lib/product-import-agent"
import type { SupplierImportUrlBody } from "@/lib/supplier-import-url-handler"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: SupplierImportUrlBody
  try {
    body = (await req.json()) as SupplierImportUrlBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const out = await runProductImportAgent(body)
  if (!out.ok) {
    return NextResponse.json(
      {
        error: out.error,
        marketplace: out.marketplace,
        useAliExpressApi: out.useAliExpressApi,
      },
      { status: out.status }
    )
  }

  return NextResponse.json({
    success: true,
    marketplace: out.marketplace,
    product: out.product,
    platform: out.platform,
    method: out.method,
    warnings: out.warnings,
    steps: out.steps,
    aiEnriched: out.aiEnriched,
    category: out.category,
  })
}
