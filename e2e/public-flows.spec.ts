import { expect, test } from "@playwright/test"

test.describe("public flows", () => {
  test("GET /api/categories returns JSON", async ({ request }) => {
    const res = await request.get("/api/categories")
    expect(res.ok()).toBeTruthy()
    expect(res.headers()["content-type"] ?? "").toMatch(/json/i)
  })

  test("login selector page renders", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("heading", { name: "Connexion Affisell" })).toBeVisible()
    await expect(page.getByRole("link", { name: /Je suis Créateur/i })).toBeVisible()
  })

  test("legacy /auth/signin redirects to /login", async ({ page }) => {
    await page.goto("/auth/signin")
    await expect(page).toHaveURL(/\/login/)
  })

  test("discover feed shell loads", async ({ page }) => {
    await page.goto("/discover")
    await expect(page).toHaveURL(/\/discover/)
    await expect(page.locator(".bg-black").first()).toBeVisible({ timeout: 30_000 })
  })

  test("legacy /marketplace redirects guests to public browse", async ({ page }) => {
    await page.goto("/marketplace")
    await expect(page).toHaveURL(/\/shops\/browse/)
  })

  test("GET /api/cart returns JSON (guest)", async ({ request }) => {
    const res = await request.get("/api/cart")
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(Array.isArray(data)).toBeTruthy()
  })

  test("wishlist sends guests to customer signup", async ({ page }) => {
    await page.goto("/wishlist")
    await expect(page).toHaveURL(/\/signup\/customer/)
  })
})
