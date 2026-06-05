import { NextResponse } from "next/server"

import {
  loadAdminSupportQueue,
  parseSupportStatusFilter,
} from "@/lib/admin/support/load-support-queue"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const url = new URL(req.url)
  const status = parseSupportStatusFilter(url.searchParams.get("status"))
  const queue = await loadAdminSupportQueue(status)

  return NextResponse.json(queue)
}
