import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { loadCatalogOpportunities } from "@/lib/strategic-intelligence/catalog-opportunities.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * ADMIN, READ-ONLY: where supply and demand do not meet — categories to recruit suppliers in, demand stuck on products
 * that can not be bought today, supply no reseller distributes, plus the product requests without (affordable) quotes.
 * Aggregates per category only; nothing is shown to suppliers or resellers, nothing is changed.
 */
export async function GET(): Promise<Response> {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  return NextResponse.json(await loadCatalogOpportunities())
}
