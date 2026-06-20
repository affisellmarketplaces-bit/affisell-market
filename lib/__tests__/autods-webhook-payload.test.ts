import { describe, expect, it } from "vitest"

import { parseAutoDsRemoteOrder } from "@/lib/autods/fetch-order"
import { parseAutoDsWebhookBody } from "@/lib/autods/parse-webhook-payload"

describe("autods webhook payload", () => {
  it("parses shipped event with tracking fields", () => {
    const parsed = parseAutoDsWebhookBody({
      event: "order.shipped",
      data: {
        autods_order_id: " ADS-42 ",
        tracking_number: "YT123456",
        tracking_url: "https://track.example/YT123456",
        carrier: "YunExpress",
        status: "SHIPPED",
      },
    })

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    expect(parsed.event).toBe("order.shipped")
    expect(parsed.payload).toEqual({
      autodsOrderId: "ADS-42",
      status: "SHIPPED",
      trackingNumber: "YT123456",
      trackingUrl: "https://track.example/YT123456",
      carrier: "YunExpress",
    })
  })

  it("derives status from event when data.status is missing", () => {
    const parsed = parseAutoDsWebhookBody({
      event: "order.delivered",
      data: {
        autods_order_id: "ADS-99",
        tracking_number: "YT999",
      },
    })

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.payload.status).toBe("DELIVERED")
  })

  it("rejects invalid body", () => {
    expect(parseAutoDsWebhookBody({ foo: "bar" }).ok).toBe(false)
  })
})

describe("autods remote order snapshot", () => {
  it("reads nested order fields from get-external response", () => {
    const snapshot = parseAutoDsRemoteOrder("ADS-1", {
      order: {
        status: "shipped",
        tracking_number: "1Z999",
        tracking_url: "https://track/1Z999",
        carrier: "UPS",
      },
    })

    expect(snapshot.status).toBe("SHIPPED")
    expect(snapshot.trackingNumber).toBe("1Z999")
    expect(snapshot.trackingUrl).toBe("https://track/1Z999")
    expect(snapshot.carrier).toBe("UPS")
  })
})

/**
 * Manual webhook test:
 * curl -sS -X POST http://localhost:3000/api/webhooks/autods \
 *   -H "Content-Type: application/json" \
 *   -H "X-AutoDS-Signature: $(printf '%s' '{"event":"order.shipped","data":{"autods_order_id":"YOUR_AUTODS_ID","tracking_number":"YT123","tracking_url":"https://track.example/YT123","carrier":"YunExpress","status":"SHIPPED"}}' | openssl dgst -sha256 -hmac "$AUTODS_WEBHOOK_SECRET" -hex | awk '{print $2}')" \
 *   -d '{"event":"order.shipped","data":{"autods_order_id":"YOUR_AUTODS_ID","tracking_number":"YT123","tracking_url":"https://track.example/YT123","carrier":"YunExpress","status":"SHIPPED"}}'
 */
