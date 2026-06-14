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
    const footer = page.locator("footer[role='contentinfo'].affisell-site-footer")
    await expect(footer).toHaveCount(1)
    await footer.scrollIntoViewIfNeeded()
    await expect(footer).toBeVisible()
    await expect(page.locator(".affisell-storefront-trust-rail")).toHaveCount(1)

    const menu = page.getByRole("button", { name: /Browse categories|Parcourir les catégories/i })
    await expect(menu).toBeVisible()
    await expect(menu).toHaveAttribute("aria-expanded", "false")

    await menu.click()
    await expect(menu).toHaveAttribute("aria-expanded", "true")

    const drawer = page.locator("#storefront-category-drawer")
    await expect(drawer).toHaveAttribute("aria-hidden", "false")
    await expect(drawer.getByRole("link", { name: /All products|Tous les produits/i })).toBeVisible()
    await expect(drawer.locator("nav ul li").nth(1).locator("svg")).toBeVisible()
  })

  test("category filter updates URL", async ({ page }) => {
    await page.goto(`http://${DEDICATED_HOST}:${devPort}/`, {
      waitUntil: "networkidle",
    })

    await page.getByRole("button", { name: /Browse categories|Parcourir les catégories/i }).click()
    const drawer = page.locator("#storefront-category-drawer")
    const categoryButtons = drawer.locator("nav ul li a").filter({ hasNotText: /All products|Tous les produits/i })
    const count = await categoryButtons.count()
    test.skip(count === 0, "No categories in demo store")

    const first = categoryButtons.first()
    await first.click()
    await expect(page).toHaveURL(/\?cat=/)
    await expect(drawer).toHaveAttribute("aria-hidden", "true")
  })

  test("cart loads without redirect loop", async ({ page }) => {
    const res = await page.goto(`http://${DEDICATED_HOST}:${devPort}/cart`, {
      waitUntil: "domcontentloaded",
    })
    expect(res?.status()).toBeLessThan(400)
    await expect(page).toHaveURL(new RegExp(`^http://${DEDICATED_HOST}:${devPort}/cart`))
    await expect(page.getByRole("button", { name: /Browse categories|Parcourir les catégories/i })).toBeVisible()
  })

  test("cart category link opens shop catalog filter", async ({ page }) => {
    await page.goto(`http://${DEDICATED_HOST}:${devPort}/cart`, {
      waitUntil: "networkidle",
    })

    await page.getByRole("button", { name: /Browse categories|Parcourir les catégories/i }).click()
    const drawer = page.locator("#storefront-category-drawer")
    const categoryButtons = drawer.locator("nav ul li a").filter({ hasNotText: /All products|Tous les produits/i })
    test.skip((await categoryButtons.count()) === 0, "No categories in demo store")

    await categoryButtons.first().click()
    await expect(page).toHaveURL(new RegExp(`^http://${DEDICATED_HOST}:${devPort}/\\?cat=`))
  })
})
