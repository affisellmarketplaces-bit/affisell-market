import { NextResponse } from "next/server"

import { fulfillAffisellOrderWithAliExpress } from "@/lib/aliexpress-fulfill-order"
import { authorizeAdminOrCron } from "@/lib/admin/authorize-admin-or-cron"
import {
  authorizeAliExpressOps,
  extractBodySecret,
  stripBodySecret,
} from "@/lib/aliexpress-ops-auth"
import { enqueueOrderPaidJob } from "@/lib/fulfillment/order-paid-queue"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type RouteCtx = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/fulfill
 * Auth: CRON_SECRET (Bearer / x-cron-secret / ?secret= / JSON secret / HMAC) or admin session.
 */
export async function POST(req: Request, ctx: RouteCtx) {
  const { id: orderId } = await ctx.params
  const rawBody = await req.text()

  let json: unknown = null
  if (rawBody.trim()) {
    try {
      json = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
    }
  }

  const opsDenied = authorizeAliExpressOps(req, {
    rawBody,
    bodySecret: extractBodySecret(json),
  })
  if (opsDenied) {
    const gate = await authorizeAdminOrCron(req)
    if (!gate.ok) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          hint: "Pass Authorization: Bearer $CRON_SECRET, x-cron-secret, ?secret=, JSON secret, or admin session",
        },
        { status: 401 }
      )
    }
  }

  if (!orderId?.trim()) {
    return NextResponse.json({ ok: false, error: "missing_order_id" }, { status: 400 })
  }

  const cleaned = stripBodySecret(json) as { async?: boolean } | null
  const asyncMode = cleaned?.async === true

  if (asyncMode) {
    await enqueueOrderPaidJob({ orderId: orderId.trim() })
    console.log("[orders-fulfill]", { result: "enqueued", orderId: orderId.trim() })
    return NextResponse.json({ ok: true, enqueued: true, orderId: orderId.trim() })
  }

  const result = await fulfillAffisellOrderWithAliExpress(orderId.trim())
  if (!result.ok) {
    const status =
      result.error === "order_not_found"
        ? 404
        : result.error === "not_paid" ||
            result.error === "no_supplier_link" ||
            result.error === "fulfillment_in_progress"
          ? 409
          : 502
    return NextResponse.json(result, { status })
  }

  return NextResponse.json(result)
}
