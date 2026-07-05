import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import {
  remediateLegacyPayoutBatch,
  remediateLegacyPayoutOrder,
  scanLegacyPayoutOrders,
} from "@/lib/payout-legacy-backfill"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const url = new URL(req.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "50") || 50, 1), 500)
  const orderId = url.searchParams.get("orderId")?.trim() || undefined

  const scan = await scanLegacyPayoutOrders({ limit, orderId })
  return NextResponse.json({ ok: true, ...scan })
}

export async function POST(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const body = (await req.json().catch(() => ({}))) as {
    orderId?: string
    limit?: number
    dryRun?: boolean
  }

  const dryRun = body.dryRun === true
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : ""
  const limit = Math.min(Math.max(Number(body.limit ?? 50) || 50, 1), 200)

  if (orderId) {
    const result = await remediateLegacyPayoutOrder(orderId, {
      dryRun,
      runTransfers: !dryRun,
    })
    return NextResponse.json({ ok: true, result })
  }

  const batch = await remediateLegacyPayoutBatch({ limit, dryRun })
  return NextResponse.json({
    ok: true,
    dryRun,
    remediated: batch.results.length,
    scan: batch.scan,
    results: batch.results,
  })
}
