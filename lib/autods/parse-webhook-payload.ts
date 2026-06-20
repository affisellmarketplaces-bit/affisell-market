import { z } from "zod"

const dataSchema = z.object({
  autods_order_id: z.string().min(1),
  tracking_number: z.string().optional().nullable(),
  tracking_url: z.string().optional().nullable(),
  carrier: z.string().optional().nullable(),
  status: z.string().optional(),
})

const bodySchema = z.object({
  event: z.enum(["order.shipped", "order.delivered", "order.failed"]),
  data: dataSchema,
})

const EVENT_STATUS: Record<(typeof bodySchema)["_output"]["event"], string> = {
  "order.shipped": "SHIPPED",
  "order.delivered": "DELIVERED",
  "order.failed": "FAILED",
}

export type AutoDsWebhookParseResult =
  | {
      ok: true
      event: string
      payload: {
        autodsOrderId: string
        status: string
        trackingNumber?: string | null
        trackingUrl?: string | null
        carrier?: string | null
      }
    }
  | { ok: false; error: string }

export function parseAutoDsWebhookBody(json: unknown): AutoDsWebhookParseResult {
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return { ok: false, error: "invalid_body" }
  }

  const statusRaw = parsed.data.data.status?.trim()
  const status = (statusRaw ? statusRaw.toUpperCase() : EVENT_STATUS[parsed.data.event]) || "PROCESSING"

  return {
    ok: true,
    event: parsed.data.event,
    payload: {
      autodsOrderId: parsed.data.data.autods_order_id.trim(),
      status,
      trackingNumber: parsed.data.data.tracking_number,
      trackingUrl: parsed.data.data.tracking_url,
      carrier: parsed.data.data.carrier,
    },
  }
}
