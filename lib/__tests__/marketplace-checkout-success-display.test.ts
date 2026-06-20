import { describe, expect, it } from "vitest"

import { resolveCheckoutSuccessDisplay } from "@/lib/marketplace-checkout-success-display"

describe("resolveCheckoutSuccessDisplay", () => {
  it("prefers Stripe session total and enriches single order", () => {
    const result = resolveCheckoutSuccessDisplay({
      sessionAmountTotal: 12_990,
      sessionCurrency: "eur",
      stripeLineDescription: null,
      orders: [
        {
          totalCents: 12_990,
          sellingPriceCents: 10_000,
          quantity: 1,
          variantLabel: "Bleu",
          variantImageUrl: "https://cdn.example/blue.jpg",
          currency: "EUR",
          productName: "Console portable",
        },
      ],
    })

    expect(result).toEqual({
      amountTotal: 12_990,
      currency: "eur",
      productName: "Console portable · Bleu",
      productImageUrl: "https://cdn.example/blue.jpg",
    })
  })

  it("falls back to order totals when session amount is missing", () => {
    const result = resolveCheckoutSuccessDisplay({
      sessionAmountTotal: null,
      sessionCurrency: null,
      stripeLineDescription: null,
      orders: [
        {
          totalCents: null,
          sellingPriceCents: 4_500,
          quantity: 2,
          variantLabel: null,
          variantImageUrl: null,
          currency: "EUR",
          productName: "T-shirt",
        },
      ],
    })

    expect(result.amountTotal).toBe(9_000)
    expect(result.productName).toBe("T-shirt")
  })

  it("uses Stripe line description before fulfillment creates orders", () => {
    const result = resolveCheckoutSuccessDisplay({
      sessionAmountTotal: 7_500,
      sessionCurrency: "eur",
      stripeLineDescription: "Commode 3 tiroirs · Blanc",
      orders: [],
    })

    expect(result).toEqual({
      amountTotal: 7_500,
      currency: "eur",
      productName: "Commode 3 tiroirs · Blanc",
      productImageUrl: null,
    })
  })
})
