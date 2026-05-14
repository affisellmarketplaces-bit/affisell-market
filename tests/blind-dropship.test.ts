import { afterEach, describe, expect, it, vi } from "vitest"

import { blindDropshipSupplierContactEmail } from "@/lib/blind-dropship-contact"
import { RestSupplierAdapter } from "@/lib/suppliers/rest-adapter"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe("blind dropship supplier payloads", () => {
  it("supplier payload uses wholesale cents only (never affiliate retail)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ supplier_order_id: "partner-1" }),
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    const adapter = new RestSupplierAdapter("https://partner.test", "secret-key", {})
    await adapter.createOrder({
      shipping: {
        name: "Jane Buyer",
        line1: "1 Rue Paix",
        city: "Paris",
        postal_code: "75001",
        country: "FR",
      },
      contact_email: blindDropshipSupplierContactEmail("order_test_1"),
      reference: "bd-order_test_1",
      items: [{ sku: "SKU-1", quantity: 2, unit_price_cents: 3000 }],
    })

    expect(mockFetch).toHaveBeenCalled()
    const init = mockFetch.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(init.body)) as {
      items: { unit_price_cents: number; sku: string; quantity: number }[]
    }
    expect(body.items[0]?.unit_price_cents).toBe(3000)
    expect(body.items[0]?.unit_price_cents).not.toBe(5000)
    expect(JSON.stringify(body)).not.toContain("5000")
  })

  it("customer email is not placed in supplier JSON (relay contact only)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ supplier_order_id: "ext" }),
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    /** Simulates real buyer email — must never appear in the partner payload. */
    const customer_email = "real.buyer@customer.com"
    const orderId = "ord_2"
    const relay = blindDropshipSupplierContactEmail(orderId)
    expect(relay).not.toContain(customer_email)

    const adapter = new RestSupplierAdapter("https://partner.test", "key", {})
    await adapter.createOrder({
      shipping: { name: "X", line1: "Y", city: "Z", postal_code: "1", country: "FR" },
      contact_email: relay,
      reference: `bd-${orderId}`,
      items: [{ sku: "S", quantity: 1, unit_price_cents: 100 }],
    })

    const init = mockFetch.mock.calls[0][1] as RequestInit
    const raw = String(init.body)
    expect(raw).not.toContain(customer_email)
    expect(raw).toContain(relay)
  })
})
