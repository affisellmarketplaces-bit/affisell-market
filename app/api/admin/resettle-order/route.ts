import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { resettleMarketplaceOrder } from "@/lib/stripe-marketplace-commission-split"
import { logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  orderId: z.string().min(1),
})

export async function POST(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 })
  }

  const { orderId } = parsed.data
  const outcome = await resettleMarketplaceOrder(orderId)

  logStripeWebhookInfo({
    level: "info",
    metric: "admin_resettle_order",
    orderId,
    ok: outcome.ok,
    error: outcome.error ?? null,
    splitErrors: outcome.result?.errors.length ?? 0,
  })

  if (!outcome.ok) {
    return NextResponse.json(
      { ok: false, error: outcome.error ?? "resettle_failed", result: outcome.result },
      { status: 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    orderId,
    supplierTransferId: outcome.result?.supplierTransfer?.id ?? null,
    affiliateTransferId: outcome.result?.affiliateTransfer?.id ?? null,
    errors: outcome.result?.errors ?? [],
  })
}
