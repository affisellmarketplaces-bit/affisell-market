import { type NextRequest, NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { loadAdminOrderTrackingAudit } from "@/lib/admin/orders/load-tracking-audit"
import { renderOrderTrackingTimelinePdf } from "@/lib/invoices/order-tracking-timeline-pdf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const { id: orderId } = await ctx.params
  const audit = await loadAdminOrderTrackingAudit(orderId)
  if (!audit) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const pdf = await renderOrderTrackingTimelinePdf(audit)

  console.log("[tracking-audit-pdf]", { orderId, eventCount: audit.timeline.length, result: "ok" })

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="affisell-tracking-audit-${orderId.slice(0, 10)}.pdf"`,
    },
  })
}
