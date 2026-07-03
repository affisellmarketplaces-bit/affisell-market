import { expect, test, type Page, type Locator } from "@playwright/test"

test.describe.configure({ mode: "serial" })

function visibleDock(page: Page, testId: string): Locator {
  return page.locator(`[data-testid="${testId}"]:visible`)
}

async function stubPulseApis(page: Page) {
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
}

/** Pointer drag on the top card — exercises Framer pan → commit path. */
async function dragSwipeCard(
  page: Page,
  direction: "left" | "right" | "up" | "down"
) {
  const card = page.getByTestId("pulse-swipe-drag-surface")
  await expect(card).toBeVisible()
  const box = await card.boundingBox()
  if (!box) throw new Error("pulse-swipe-drag-surface has no bounding box")

  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const delta =
    direction === "left"
      ? [-240, 0]
      : direction === "right"
        ? [240, 0]
        : direction === "up"
          ? [0, -240]
          : [0, 240]

  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + delta[0], cy + delta[1], { steps: 16 })
  await page.mouse.up()
}

async function expectSwipeToast(page: Page, pattern: RegExp) {
  await expect(page.locator(".affisell-swipe-toast")).toContainText(pattern, { timeout: 12_000 })
}

async function openPulseSwipe(page: Page) {
  await page.goto("/discover?e2eFixtures=1")
  await expect(page.getByTestId("affisell-pulse")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId("pulse-swipe-dock")).toBeVisible()
  await expect(page.getByTestId("pulse-swipe-drag-surface")).toBeVisible()
  await expect(page.getByRole("heading", { name: "E2E Pulse Alpha" })).toBeVisible()
}

test.describe("Pulse swipe commerce", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await stubPulseApis(page)
  })

  test("dock exposes cart, buy, save and skip actions", async ({ page }) => {
    await openPulseSwipe(page)

    await expect(visibleDock(page, "pulse-swipe-dock-up")).toBeVisible()
    await expect(visibleDock(page, "pulse-swipe-dock-down")).toBeVisible()
    await expect(visibleDock(page, "pulse-swipe-dock-left")).toBeVisible()
    await expect(visibleDock(page, "pulse-swipe-dock-right")).toBeVisible()
  })

  test("dock cart adds to cart and advances deck", async ({ page }) => {
    await openPulseSwipe(page)

    await visibleDock(page, "pulse-swipe-dock-up").click()
    await expectSwipeToast(page, /Added to cart/i)
    await expect(page.getByRole("heading", { name: "E2E Pulse Beta" })).toBeVisible({ timeout: 10_000 })
  })

  test("dock save drop advances deck", async ({ page }) => {
    await openPulseSwipe(page)

    await visibleDock(page, "pulse-swipe-dock-down").click()
    await expectSwipeToast(page, /Save Drop|wishlist/i)
    await expect(page.getByRole("heading", { name: "E2E Pulse Beta" })).toBeVisible({ timeout: 10_000 })
  })

  test("save drop refreshes recommended picks rail", async ({ page }) => {
    let picksCalls = 0
    await page.route("**/api/buyer/personalized-picks", async (route) => {
      picksCalls += 1
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          personalized: true,
          items: [
            {
              listingId: "e2e-listing-pick-1",
              productId: "e2e-product-pick-1",
              name: "E2E Recommended Pick",
              imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=640&q=80",
              priceCents: 3900,
              compareAtCents: null,
              soldCount: 8,
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
            },
          ],
        }),
      })
    })

    await openPulseSwipe(page)
    await expect(page.getByText("E2E Recommended Pick 1")).toBeVisible({ timeout: 15_000 })

    const before = picksCalls
    await visibleDock(page, "pulse-swipe-dock-down").click()
    await expectSwipeToast(page, /Save Drop|wishlist/i)
    await expect.poll(() => picksCalls, { timeout: 10_000 }).toBeGreaterThan(before)
  })

  test("dock skip advances deck without toast", async ({ page }) => {
    await openPulseSwipe(page)

    await visibleDock(page, "pulse-swipe-dock-left").click()
    await expect(page.locator(".affisell-swipe-toast")).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "E2E Pulse Beta" })).toBeVisible({ timeout: 10_000 })
  })

  test("keyboard arrow up adds to cart", async ({ page }) => {
    await openPulseSwipe(page)

    await page.getByTestId("affisell-pulse").click()
    await page.keyboard.press("ArrowUp")
    await expectSwipeToast(page, /Added to cart/i)
    await expect(page.getByRole("heading", { name: "E2E Pulse Beta" })).toBeVisible({ timeout: 10_000 })
  })

  test("pointer drag left skips to next card", async ({ page }) => {
    await openPulseSwipe(page)

    await dragSwipeCard(page, "left")
    await expect(page.getByRole("heading", { name: "E2E Pulse Beta" })).toBeVisible({ timeout: 12_000 })
  })

  test("undo brings skipped product back", async ({ page }) => {
    await openPulseSwipe(page)

    await visibleDock(page, "pulse-swipe-dock-left").click()
    await expect(page.getByRole("heading", { name: "E2E Pulse Beta" })).toBeVisible({ timeout: 10_000 })

    await visibleDock(page, "pulse-swipe-dock-undo").click()
    await expectSwipeToast(page, /back in stack|de retour/i)
    await expect(page.getByRole("heading", { name: "E2E Pulse Alpha" })).toBeVisible({ timeout: 10_000 })
  })
})
