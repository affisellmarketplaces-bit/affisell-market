import { NextResponse } from "next/server"

import { loadAdminLightningSuppliers } from "@/lib/admin/suppliers/load-lightning-suppliers"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Admin: liste fournisseurs + statut Lightning Payout. */
export async function GET() {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const data = await loadAdminLightningSuppliers()
  return NextResponse.json(data)
}
