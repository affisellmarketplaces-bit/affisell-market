import { expect, test } from "@playwright/test"

import {
  E2E_CHECKOUT_SUCCESS_PATH,
  seedCookieConsent,
  stubBuyerCheckoutApis,
  type BuyerCheckoutStubState,
} from "./helpers/buyer-checkout-identity"

function personalizedPick(index: number) {
  return {
    listingId: `e2e-success-pick-${index}`,
    productId: `e2e-success-product-${index}`,
    name: `E2E Success Pick ${index}`,
    imageUrl: "/placeholder.png",
    priceCents: 3_900 + index * 100,
    compareAtCents: null,
    soldCount: 8 + index,
    marginCents: 0,
    deliveryMin: 2,
    deliveryMax: 5,
    stock: 12,
    freeShipping: true,
    commissionPct: 0,
    averageRating: 4.7,
    reviewCount: 9,
    storeName: "E2E Store",
    storeSlug: "e2e-store",
    nicheLabel: "lifestyle",
    categories: ["Fashion"],
    isBestSeller: false,
  }
}

test.describe("Success conversion hub", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("shows trust band, review CTA, and recommended rail after payment", async ({ page, context }) => {
    const stubState: BuyerCheckoutStubState = {
      identifiedCalls: 0,
      buyerIdentifyCalls: 0,
      lastIdentifiedBody: null,
    }

    await seedCookieConsent(context)
    await stubBuyerCheckoutApis(page, stubState)

    await page.route("**/api/buyer/personalized-picks", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          personalized: true,
          items: [1, 2, 3, 4].map(personalizedPick),
        }),
      })
    })

    await page.goto(E2E_CHECKOUT_SUCCESS_PATH)

    await expect(page.getByTestId("success-conversion-hub")).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId("success-trust-band")).toBeVisible()
    await expect(page.getByTestId("success-review-cta")).toBeVisible()
    await expect(page.getByRole("link", { name: /leave a review|laisser un avis/i })).toHaveAttribute(
      "href",
      /writeReview=true&orderId=e2e-order-checkout/
    )
    await expect(
      page.getByRole("heading", { name: /recommended for you|recommandé pour vous/i })
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText("E2E Success Pick 1")).toBeVisible()
  })
})
