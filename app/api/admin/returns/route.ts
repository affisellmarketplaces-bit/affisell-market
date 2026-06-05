import { NextResponse } from "next/server"

import {
  loadAdminReturnsQueue,
  parseReturnsStatusFilter,
} from "@/lib/admin/returns/load-returns-queue"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const url = new URL(req.url)
  const status = parseReturnsStatusFilter(url.searchParams.get("status"))
  const queue = await loadAdminReturnsQueue(status)

  return NextResponse.json(queue)
}
