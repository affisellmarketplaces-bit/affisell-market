import { NextResponse } from "next/server"

import { guardSupplierAiRoute } from "@/lib/ai-route-guards"
import { get1688 } from "@/lib/onebound"

/**
 * POST { url } → { ok:true, product } | { ok:false, error }
 *
 * Supplier/admin only (+ the shared per-user rate limit): every call consumes the paid OneBound quota. It used to be
 * open to anyone (finalisation master doc, C2).
 */
export async function POST(req) {
  const guard = await guardSupplierAiRoute(req, "import-1688")
  if (!guard.ok) return guard.response

  let body = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400 })
  }

  const url = typeof body?.url === "string" ? body.url.trim() : ""
  if (!url) {
    return NextResponse.json({ ok: false, error: "url manquante" }, { status: 400 })
  }

  try {
    const product = await get1688(url)

    // TODO: persister en base (idempotent sur product.source) :
    // await db.product.create({ data: { ...product, supplierId } })

    console.log("[import-1688]", {
      source: product.source,
      name: product.name.slice(0, 60),
      variants: product.variants.length,
      result: "fetched",
    })

    return NextResponse.json({ ok: true, product })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import 1688 échoué"
    console.error("[import-1688]", { url: url.slice(0, 120), result: "error", message })
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
