import { createHmac, timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import { fulfillAffisellOrderWithAliExpress } from "@/lib/aliexpress-fulfill-order"
import { authorizeAdminOrCron } from "@/lib/admin/authorize-admin-or-cron"
import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { mustEnforceProductionSecrets } from "@/lib/require-production-secret"
import { enqueueOrderPaidJob } from "@/lib/fulfillment/order-paid-queue"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type RouteCtx = { params: Promise<{ id: string }> }

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8")
    const bb = Buffer.from(b, "utf8")
    if (ba.length !== bb.length) return false
    return timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

async function authorizeFulfill(req: Request, rawBody: string): Promise<NextResponse | null> {
  const secret = process.env.CRON_SECRET?.trim() ?? ""
  if (!secret && mustEnforceProductionSecrets()) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 })
  }

  if (secret) {
    const cronDenied = authorizeCronRequest(req)
    if (cronDenied === null) return null

    const sig =
      req.headers.get("x-affisell-signature")?.trim() ||
      req.headers.get("x-hub-signature-256")?.trim() ||
      ""
    if (sig) {
      const hex = createHmac("sha256", secret).update(rawBody || "{}", "utf8").digest("hex")
      const provided = sig.replace(/^sha256=/i, "").trim()
      if (safeEqualHex(provided, hex)) return null
    }
  }

  const gate = await authorizeAdminOrCron(req)
  if (gate.ok) return null

  return NextResponse.json({ error: gate.error ?? "Unauthorized" }, { status: gate.status ?? 401 })
}

/**
 * POST /api/orders/[id]/fulfill
 * Places AliExpress DS order for a paid Affisell order (idempotent).
 * Auth: CRON_SECRET (Bearer / x-cron-secret / HMAC) or admin session.
 */
export async function POST(req: Request, ctx: RouteCtx) {
  const { id: orderId } = await ctx.params
  const rawBody = await req.text()
  const denied = await authorizeFulfill(req, rawBody)
  if (denied) return denied

  if (!orderId?.trim()) {
    return NextResponse.json({ ok: false, error: "missing_order_id" }, { status: 400 })
  }

  let asyncMode = false
  try {
    const parsed = rawBody ? (JSON.parse(rawBody) as { async?: boolean }) : {}
    asyncMode = parsed.async === true
  } catch {
    /* empty body ok */
  }

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
        : result.error === "not_paid" || result.error === "no_supplier_link"
          ? 409
          : 502
    return NextResponse.json(result, { status })
  }

  return NextResponse.json(result)
}
