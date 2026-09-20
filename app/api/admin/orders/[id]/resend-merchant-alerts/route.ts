import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { dispatchMerchantOrderAlerts } from "@/lib/emails/dispatch-merchant-order-alerts"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/**
 * Force-resend merchant emails for one paid order (ops heal).
 * Body: `{ "role": "supplier" | "affiliate" | "both" }` (default supplier).
 */
export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const { id: orderId } = await ctx.params
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      merchantSupplierEmailSentAt: true,
      merchantAffiliateEmailSentAt: true,
      supplier: { select: { email: true } },
    },
  })

  if (!order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 })
  }
  if (order.status !== "paid") {
    return NextResponse.json({ error: "order_not_paid", status: order.status }, { status: 409 })
  }

  let role: "supplier" | "affiliate" | "both" = "supplier"
  try {
    const body = (await req.json().catch(() => ({}))) as { role?: string }
    if (body.role === "affiliate" || body.role === "both" || body.role === "supplier") {
      role = body.role
    }
  } catch {
    // default supplier
  }

  const result = await dispatchMerchantOrderAlerts(orderId, {
    forceSupplier: role === "supplier" || role === "both",
    forceAffiliate: role === "affiliate" || role === "both",
  })

  console.log("[admin-resend-merchant-alerts]", {
    orderId,
    role,
    adminId: gate.session.user.id,
    supplier: result.supplier,
    affiliate: result.affiliate,
    supplierResendId: result.supplierResendId ?? null,
  })

  return NextResponse.json({
    ok: result.supplier === "sent" || result.affiliate === "sent",
    orderId,
    role,
    supplierEmail: order.supplier.email,
    previouslyMarkedSupplierSent: Boolean(order.merchantSupplierEmailSentAt),
    previouslyMarkedAffiliateSent: Boolean(order.merchantAffiliateEmailSentAt),
    result,
  })
}
