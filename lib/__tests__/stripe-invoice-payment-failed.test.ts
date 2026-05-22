import { describe, expect, it } from "vitest"
import type Stripe from "stripe"

import { resolveOrderIdFromInvoice } from "@/lib/stripe-invoice-payment-failed"

describe("resolveOrderIdFromInvoice", () => {
  it("reads orderId from invoice metadata", () => {
    const invoice = {
      metadata: { orderId: "order_abc" },
      lines: { data: [] },
    } as unknown as Stripe.Invoice
    expect(resolveOrderIdFromInvoice(invoice)).toBe("order_abc")
  })

  it("reads orderId from first line metadata", () => {
    const invoice = {
      metadata: {},
      lines: {
        data: [{ metadata: { orderId: "order_line" } }],
      },
    } as unknown as Stripe.Invoice
    expect(resolveOrderIdFromInvoice(invoice)).toBe("order_line")
  })
})
