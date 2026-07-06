import { expect, test, type Page, type Locator } from "@playwright/test"

import { PENDING_PRICE_PUSH_AFTER_LOGIN_KEY } from "../lib/wishlist-push-nudge.client"

function visibleDock(page: Page, testId: string): Locator {
  return page.locator(`[data-testid="${testId}"]:visible`)
}

async function stubPulseGuestApis(page: Page) {
  await page.route("**/api/buyer/swipe-feed**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ products: [] }),
    })
  })

  await page.route("**/api/pulse/view", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.route("**/api/cart/add", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: "{}" })
  })

  await page.route("**/api/wishlist/toggle", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ wished: true, likeCount: 1 }),
    })
  })

  await page.route("**/api/auth/session**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: null }),
    })
  })
}

test.describe("LTV loop hardening", () => {
  test.describe("Flash sale deep link", () => {
    test("hash scroll reveals flash sale section", async ({ page }) => {
      await page.goto("/shops/e2e-flash-shop?e2eFlashSale=1#flash-sale")
      const section = page.getByTestId("flash-sale-section")
      await expect(section).toBeVisible({ timeout: 20_000 })
      await expect(section.getByTestId("flash-sale-countdown")).toBeVisible()

      await expect
        .poll(async () =>
          section.evaluate((el) => {
            const rect = el.getBoundingClientRect()
            return rect.top >= 0 && rect.top < window.innerHeight
          })
        )
        .toBe(true)
    })
  })

  test.describe("Opportunity Pulse badge", () => {
    test("shows creators watching badge when count >= 2", async ({ page }) => {
      await page.goto("/e2e/ltv/badge?count=3")
      const badge = page.getByTestId("affiliate-creators-watching-badge")
      await expect(badge).toBeVisible({ timeout: 15_000 })
      await expect(badge).toContainText("3")
    })

    test("hides badge when count < 2", async ({ page }) => {
      await page.goto("/e2e/ltv/badge?count=1")
      await expect(page.getByTestId("affiliate-creators-watching-badge")).toHaveCount(0)
      await expect(page.getByTestId("badge-hidden")).toBeVisible()
    })
  })

  test.describe("Pulse guest save drop", () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test.beforeEach(async ({ page }) => {
      await stubPulseGuestApis(page)
    })

    test("guest save drop redirects to login with pending push flag", async ({ page }) => {
      await page.goto("/discover?e2eFixtures=1")
      await expect(page.getByTestId("affisell-pulse")).toBeVisible({ timeout: 30_000 })
      await visibleDock(page, "pulse-swipe-dock-down").click()

      await expect(page).toHaveURL(/\/login\?callbackUrl=/, { timeout: 12_000 })
      const pending = await page.evaluate(
        (key) => sessionStorage.getItem(key),
        PENDING_PRICE_PUSH_AFTER_LOGIN_KEY
      )
      expect(pending).toBe("1")
    })
  })
})
