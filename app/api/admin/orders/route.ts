import { type NextRequest, NextResponse } from "next/server"

import { listAdminOrders } from "@/lib/admin/orders/list-orders"
import { parseAdminOrdersListQuery } from "@/lib/admin/orders/list-query"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const query = parseAdminOrdersListQuery(new URL(req.url).searchParams)
  const orders = await listAdminOrders(query)
  return NextResponse.json({ orders })
}
