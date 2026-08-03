import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { listAdminSupplierBoutiques } from "@/lib/admin/products/push-product-to-supplier"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/admin/supplier-boutiques
 * Liste des boutiques fournisseurs pour le Push AutoBuy.
 */
export async function GET() {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const suppliers = await listAdminSupplierBoutiques(200)
  return NextResponse.json({ ok: true, suppliers })
}
