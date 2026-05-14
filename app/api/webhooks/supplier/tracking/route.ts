import { createHmac, timingSafeEqual } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { sendBlindDropshipShippedEmail } from "@/lib/blind-dropship-shipped-email"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  supplier_order_id: z.string().min(1),
  tracking_number: z.string().min(1),
  tracking_carrier: z.string().min(1).optional(),
})

function verifyHmac(secret: string, raw: string, sigHeader: string | null): boolean {
  if (!sigHeader) return false
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest("hex")
  const provided = sigHeader.replace(/^sha256=/i, "").trim()
  if (provided.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expected, "utf8"))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get("sid")?.trim()
  if (!sid) {
    return NextResponse.json({ error: "Missing sid query (blind supplier config id)" }, { status: 400 })
  }

  const raw = await req.text()
  const supplier = await prisma.blindDropshipSupplier.findUnique({ where: { id: sid } })
  if (!supplier) {
    return NextResponse.json({ error: "Unknown supplier endpoint" }, { status: 404 })
  }
  const cfg = (supplier.config ?? {}) as Record<string, unknown>
  const secret = typeof cfg.webhookSecret === "string" ? cfg.webhookSecret.trim() : ""
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured on supplier profile" }, { status: 501 })
  }

  const sig = req.headers.get("x-signature") ?? req.headers.get("x-webhook-signature")
  if (!verifyHmac(secret, raw, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let json: unknown
  try {
    json = JSON.parse(raw) as unknown
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 })
  }
  const { supplier_order_id, tracking_number, tracking_carrier } = parsed.data

  const item = await prisma.blindDropshipOrderItem.findFirst({
    where: {
      supplierOrderId: supplier_order_id,
      blindDropshipSupplierId: sid,
    },
    include: { order: true },
  })
  if (!item) {
    return NextResponse.json({ error: "Order line not found for supplier_order_id" }, { status: 404 })
  }

  await prisma.blindDropshipOrder.update({
    where: { id: item.blindDropshipOrderId },
    data: {
      trackingNumber: tracking_number,
      trackingCarrier: tracking_carrier ?? "Carrier",
      status: "shipped",
    },
  })

  const emailResult = await sendBlindDropshipShippedEmail({
    to: item.order.customerEmail,
    orderId: item.order.id,
    carrier: tracking_carrier ?? "Carrier",
    trackingNumber: tracking_number,
  })

  return NextResponse.json({
    ok: true,
    email: emailResult.ok ? "sent" : `skipped:${emailResult.error ?? "unknown"}`,
  })
}
