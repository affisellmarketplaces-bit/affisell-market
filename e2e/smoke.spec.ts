import { expect, test } from "@playwright/test"
import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "../lib/affiliate-routes"

test.describe.configure({ mode: "serial" })

test.describe("smoke", () => {
  test("home shows hero and CTA", async ({ page }) => {
    await page.goto("/")
    await expect(
      page.getByRole("heading", { level: 1, name: /Stores curated by your favorite/i })
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Explore catalog" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible()
    await expect(
      page.getByPlaceholder("Search products, brands, niches…")
    ).toBeVisible()
  })

  test("home → catalog via CTA", async ({ page }) => {
    await page.goto("/")
    const explore = page.getByRole("link", { name: "Explore catalog" })
    await expect(explore).toBeVisible()
    await explore.click()
    await expect(page).toHaveURL(/#explorer|\/shops\/browse/)
    await expect(page.locator("#explorer")).toBeVisible({ timeout: 30_000 })
  })

  test("header exposes Cart from catalog", async ({ page }) => {
    await page.goto(PUBLIC_MARKETPLACE_BROWSE_PATH)
    await expect(page).toHaveURL(/#explorer/)
    const cartLink = page.getByRole("link", { name: /Shopping cart|^Cart$/i })
    await expect(cartLink).toBeVisible()
    await cartLink.click()
    await expect(page).toHaveURL(/\/cart/)
  })
})
