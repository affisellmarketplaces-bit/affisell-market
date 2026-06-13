import { expect, test } from "@playwright/test"

const DEDICATED_HOST = "ecom-store.shops.localhost"
const devPort = process.env.PORT ?? "3001"

test.describe("dedicated affiliate storefront", () => {
  test("hides platform chrome and opens category drawer", async ({ page }) => {
    await page.goto(`http://${DEDICATED_HOST}:${devPort}/`, {
      waitUntil: "domcontentloaded",
    })

    await expect(page.locator("body")).toHaveClass(/affisell-dedicated-storefront/)
    await expect(page.locator(".affisell-global-site-header")).toBeHidden()
    await expect(page.locator(".affisell-mobile-buyer-dock")).toBeHidden()

    const menu = page.getByRole("button", { name: /Browse categories|Parcourir les catégories/i })
    await expect(menu).toBeVisible()
    await expect(menu).toHaveAttribute("aria-expanded", "false")

    await menu.click()
    await expect(menu).toHaveAttribute("aria-expanded", "true")

    const drawer = page.locator("#storefront-category-drawer")
    await expect(drawer).toHaveAttribute("aria-hidden", "false")
    await expect(drawer.getByRole("button", { name: /All products|Tous les produits/i })).toBeVisible()
  })

  test("category filter updates URL", async ({ page }) => {
    await page.goto(`http://${DEDICATED_HOST}:${devPort}/`, {
      waitUntil: "networkidle",
    })

    await page.getByRole("button", { name: /Browse categories|Parcourir les catégories/i }).click()
    const drawer = page.locator("#storefront-category-drawer")
    const categoryButtons = drawer.locator("nav ul li button").filter({ hasNotText: /All products|Tous les produits/i })
    const count = await categoryButtons.count()
    test.skip(count === 0, "No categories in demo store")

    const first = categoryButtons.first()
    await first.click()
    await expect(page).toHaveURL(/\?cat=/)
    await expect(drawer).toHaveAttribute("aria-hidden", "true")
  })
})
