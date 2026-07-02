import { expect, test } from "@playwright/test"

type PicksApiState = {
  calls: number
}

function personalizedPick(index: number) {
  return {
    listingId: `e2e-pick-${index}`,
    productId: `e2e-product-${index}`,
    name: `E2E Recommended ${index}`,
    imageUrl: "/placeholder.png",
    priceCents: 4_900 + index * 100,
    compareAtCents: null,
    soldCount: 10 + index,
    marginCents: 0,
    deliveryMin: 2,
    deliveryMax: 4,
    stock: 9,
    freeShipping: true,
    commissionPct: 0,
    averageRating: 4.8,
    reviewCount: 12,
    storeName: "E2E Store",
    storeSlug: "e2e-store",
    nicheLabel: "lifestyle",
    categories: ["Fashion"],
    isBestSeller: true,
  }
}

async function stubRecommendationRefreshApis(page: Parameters<typeof test>[0]["page"], state: PicksApiState) {
  await page.route("**/api/pulse/view", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.route("**/api/buyer/personalized-picks", async (route) => {
    state.calls += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        personalized: true,
        items: [1, 2, 3, 4].map(personalizedPick),
      }),
    })
  })
}

test.describe("Buyer personalization refresh", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("discover checkout success refreshes recommended picks and cleans URL", async ({ page }) => {
    const state: PicksApiState = { calls: 0 }
    await stubRecommendationRefreshApis(page, state)

    await page.goto("/discover?e2eFixtures=1&success=true")

    await expect(page.getByTestId("affisell-pulse")).toBeVisible({ timeout: 30_000 })
    await expect(page).toHaveURL(/\/discover\?e2eFixtures=1$/)
    await expect(
      page.getByRole("heading", { name: /recommended for you|recommandé pour vous/i })
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText("E2E Recommended 1")).toBeVisible({ timeout: 15_000 })
    expect(state.calls).toBeGreaterThanOrEqual(1)
  })
})
