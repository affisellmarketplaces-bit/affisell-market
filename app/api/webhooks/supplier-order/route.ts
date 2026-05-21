import { createHmac, timingSafeEqual } from "node:crypto"

import type { Prisma } from "@prisma/client"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import {
  extractTrackingFromPartnerPayload,
  mapOrderStatusToFulfillment,
  mapOrderStatusToMarketplaceFulfillment,
  parsePartnerOrderStatusPayload,
} from "@/lib/suppliers/order-status"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const webhookSchema = z.object({
  supplierOrderId: z.string().min(1),
  status: z.string().optional(),
  tracking_number: z.string().optional(),
  tracking_url: z.string().optional(),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().optional(),
  carrier: z.string().optional(),
  providerSlug: z.string().optional(),
  fulfillmentProviderId: z.string().optional(),
  event: z.string().optional(),
})

function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.SUPPLIER_ORDER_WEBHOOK_SECRET?.trim()
  if (!secret) return true
  if (!signature) return false
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  const sig = signature.replace(/^sha256=/, "")
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get("x-affisell-signature") ?? req.headers.get("x-signature")

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 })
  }

  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = webhookSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data
  const job = await prisma.supplierFulfillmentOrder.findFirst({
    where: {
      supplierOrderId: data.supplierOrderId,
      ...(data.fulfillmentProviderId
        ? { fulfillmentProviderId: data.fulfillmentProviderId }
        : data.providerSlug
          ? { provider: { slug: data.providerSlug } }
          : {}),
    },
    include: { lines: true },
  })

  if (!job) {
    return NextResponse.json({ error: "job_not_found" }, { status: 404 })
  }

  const statusValue = data.status
    ? parsePartnerOrderStatusPayload({ status: data.status })
    : parsePartnerOrderStatusPayload(json)
  const tracking = extractTrackingFromPartnerPayload({
    ...((json && typeof json === "object" ? json : {}) as object),
    tracking_number: data.tracking_number ?? data.trackingNumber,
    tracking_url: data.tracking_url ?? data.trackingUrl,
  })

  const prismaStatus = mapOrderStatusToFulfillment(statusValue)
  const lineFulfillment = mapOrderStatusToMarketplaceFulfillment(statusValue)

  await prisma.supplierFulfillmentOrder.update({
    where: { id: job.id },
    data: {
      status: prismaStatus,
      rawResponse: json as Prisma.InputJsonValue,
      processedAt: new Date(),
    },
  })

  for (const line of job.lines) {
    await prisma.supplierFulfillmentOrderLine.update({
      where: { id: line.id },
      data: {
        trackingNumber: tracking.trackingNumber ?? line.trackingNumber,
        trackingUrl: tracking.trackingUrl ?? line.trackingUrl,
        fulfilledAt:
          statusValue === "SHIPPED" || statusValue === "DELIVERED"
            ? line.fulfilledAt ?? new Date()
            : line.fulfilledAt,
      },
    })
    await prisma.order.update({
      where: { id: line.orderId },
      data: {
        fulfillmentStatus: lineFulfillment,
        fulfilledAt:
          lineFulfillment === "SHIPPED" || lineFulfillment === "DELIVERED" ? new Date() : null,
      },
    })
  }

  return NextResponse.json({
    ok: true,
    supplierFulfillmentOrderId: job.id,
    status: statusValue,
  })
}
