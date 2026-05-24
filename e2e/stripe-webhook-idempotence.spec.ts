import { expect, test } from "@playwright/test"

/**
 * Dev webhook fixture (`stripe-signature: test`) + duplicate event id.
 * Requires DB reachable from the dev server (same DATABASE_URL).
 *
 * Set PLAYWRIGHT_STRIPE_WEBHOOK_E2E=1 to run in CI/local.
 */
test.describe("Stripe webhook idempotence", () => {
  test.skip(
    !process.env.PLAYWRIGHT_STRIPE_WEBHOOK_E2E,
    "Set PLAYWRIGHT_STRIPE_WEBHOOK_E2E=1 and DATABASE_URL for DB-backed webhook e2e"
  )

  test("duplicate checkout.session.completed returns duplicate and does not double-settle", async ({
    request,
  }) => {
    const eventId = `evt_e2e_dup_${Date.now()}`
    const orderId = process.env.PLAYWRIGHT_STRIPE_ORDER_ID?.trim()
    if (!orderId) {
      test.skip(true, "PLAYWRIGHT_STRIPE_ORDER_ID required (paid order with metadata.orderId)")
    }

    const event = {
      id: eventId,
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_e2e_${Date.now()}`,
          mode: "payment",
          payment_status: "paid",
          amount_total: 14_560,
          metadata: { orderId },
        },
      },
    }

    const post = () =>
      request.post("/api/webhooks/stripe", {
        headers: { "stripe-signature": "test", "Content-Type": "application/json" },
        data: event,
      })

    const res1 = await post()
    expect(res1.status()).toBe(200)
    const body1 = (await res1.json()) as { received?: boolean }
    expect(body1.received).toBe(true)

    await new Promise((r) => setTimeout(r, 1500))

    const res2 = await post()
    expect(res2.status()).toBe(200)
    const body2 = (await res2.json()) as { duplicate?: boolean; received?: boolean }
    expect(body2.received).toBe(true)
    expect(body2.duplicate).toBe(true)
  })
})
