import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { commitSupplierDropForgeImport } from "@/lib/supplier-dropforge-import.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** DropForge B2B commit — SUPPLIER only. Creates catalog Product (+ SupplierLink for AE). */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized", code: "auth_required" }, { status: 401 })
  }
  if (session.user.role !== "SUPPLIER" && session.user.role !== "ADMIN") {
    return NextResponse.json(
      {
        error: "Compte fournisseur requis — DropForge remplit le catalogue B2B Affisell.",
        code: "supplier_required",
      },
      { status: 403 }
    )
  }

  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, session.user.id), {
    limit: 40,
    windowMs: 60 * 60 * 1000,
    prefix: "dropforge-commit",
  })
  if (limited) return limited

  const body = (await req.json().catch(() => ({}))) as {
    url?: string
    wholesalePriceEur?: number
    titleOverride?: string
    publishLive?: boolean
    snapshot?: unknown
  }
  const url = typeof body.url === "string" ? body.url.trim() : ""
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 })
  }

  const result = await commitSupplierDropForgeImport({
    supplierId: session.user.id,
    supplierEmail: session.user.email ?? `${session.user.id}@affisell.local`,
    supplierName: session.user.name,
    sourceUrl: url,
    wholesalePriceEur:
      typeof body.wholesalePriceEur === "number" && Number.isFinite(body.wholesalePriceEur)
        ? body.wholesalePriceEur
        : undefined,
    titleOverride:
      typeof body.titleOverride === "string" ? body.titleOverride : undefined,
    publishLive: body.publishLive === true,
    snapshot: body.snapshot,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    ok: true,
    productId: result.productId,
    storeSlug: result.storeSlug,
    editHref: result.editHref,
    catalogHref: result.catalogHref,
    isPublished: result.isPublished,
    fulfillmentReady: result.fulfillmentReady,
  })
}
