import { NextResponse } from "next/server"
import { z } from "zod"

import { createAliExpressDsOrder } from "@/lib/aliexpress-ds-create-order"
import {
  authorizeAliExpressOps,
  extractBodySecret,
  stripBodySecret,
} from "@/lib/aliexpress-ops-auth"
import { summarizeAddressForLog } from "@/lib/aliexpress-mapping"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const bodySchema = z.object({
  supplierProductId: z.string().min(1).max(64),
  skuId: z.string().min(1).max(128),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
  shippingAddress: z.object({
    name: z.string().min(1).max(200),
    phone: z.string().min(5).max(40),
    email: z.string().email().optional(),
    address1: z.string().min(1).max(200),
    address2: z.string().max(200).optional(),
    city: z.string().min(1).max(120),
    zip: z.string().min(1).max(32),
    countryCode: z.string().min(2).max(32),
    state: z.string().max(120).optional(),
  }),
  customerNote: z.string().max(500).optional(),
})

/**
 * POST /api/aliexpress/order/create
 * Auth: Bearer / x-cron-secret / ?secret= / JSON `secret` / HMAC signature.
 */
export async function POST(req: Request) {
  const rawBody = await req.text()

  let json: unknown
  try {
    json = rawBody ? JSON.parse(rawBody) : null
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const denied = authorizeAliExpressOps(req, {
    rawBody,
    bodySecret: extractBodySecret(json),
  })
  if (denied) return denied

  const parsed = bodySchema.safeParse(stripBodySecret(json))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const body = parsed.data
  console.log("[aliexpress-order-create]", {
    result: "request",
    supplierProductId: body.supplierProductId,
    skuTail: body.skuId.slice(-4),
    quantity: body.quantity,
    ...summarizeAddressForLog(body.shippingAddress),
  })

  const result = await createAliExpressDsOrder({
    supplierProductId: body.supplierProductId,
    skuId: body.skuId,
    quantity: body.quantity,
    shippingAddress: body.shippingAddress,
    customerNote: body.customerNote,
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        methodAttempts: result.methodAttempts,
        debug: result.debugPayload ?? null,
      },
      { status: 502 }
    )
  }

  return NextResponse.json({
    ok: true,
    aliexpressOrderId: result.aliexpressOrderId,
    trackingPreview: result.trackingPreview,
    method: result.method,
    dryRun: result.dryRun === true,
  })
}
