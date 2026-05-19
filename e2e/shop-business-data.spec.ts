import { expect, test } from "@playwright/test"

test.describe("customer vs affiliate product surfaces", () => {
  test("marketplace emits noindex robots meta", async ({ page }) => {
    await page.goto("/marketplace")
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      "content",
      /noindex/i
    )
  })

  test("private /shops/[slug]/product/[id]: no “Marge” mention", async ({ page }) => {
    const slug = process.env.PLAYWRIGHT_PUBLIC_SHOP_SLUG?.trim()
    const listingId = process.env.PLAYWRIGHT_PUBLIC_LISTING_ID?.trim()
    test.skip(
      !slug || !listingId,
      "Set PLAYWRIGHT_PUBLIC_SHOP_SLUG and PLAYWRIGHT_PUBLIC_LISTING_ID (public listed product)."
    )

    await page.goto(`/shops/${slug}/product/${listingId}`)
    await expect(page.getByText(/Marge\b/i)).toHaveCount(0)
  })

  test("guest marketplace product cards: customer mode, no Marge", async ({ page }) => {
    await page.goto("/marketplace")
    await page.waitForSelector('[data-product-card-mode="customer"]', { timeout: 45_000 })
    await expect(page.getByText(/\bMarge\b/i)).toHaveCount(0)
  })

  test("affiliate on marketplace: sees Marge on product cards", async ({ page }) => {
    test.skip(!process.env.PLAYWRIGHT_AFFILIATE_E2E, "Set PLAYWRIGHT_AFFILIATE_E2E=1 and seed session.")
    await page.goto("/marketplace")
    await expect(page.locator('[data-product-card-mode="affiliate"]').first()).toBeVisible({
      timeout: 45_000,
    })
    await expect(page.getByText(/\bMarge\b/i).first()).toBeVisible({ timeout: 45_000 })
  })

  test("affiliate ?preview=affiliate on boutique: sees Marge", async ({ page }) => {
    test.skip(!process.env.PLAYWRIGHT_AFFILIATE_E2E, "Set PLAYWRIGHT_AFFILIATE_E2E=1 and seed session.")

    const slug = process.env.PLAYWRIGHT_PUBLIC_SHOP_SLUG?.trim()
    test.skip(!slug, "Set PLAYWRIGHT_PUBLIC_SHOP_SLUG for your affiliate storefront slug.")

    await page.goto(`/shops/${slug}?preview=affiliate`)
    await expect(page.getByText(/Marge/i).first()).toBeVisible({ timeout: 45_000 })
  })
})
