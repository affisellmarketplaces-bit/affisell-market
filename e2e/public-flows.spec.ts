import { expect, test } from "@playwright/test"

/** Core marketing and buyer routes — must not 404 (next-intl vs static segment regression). */
const PUBLIC_PAGE_PATHS = [
  "/",
  "/agent",
  "/creators",
  "/partners",
  "/contact",
  "/faq",
  "/discover",
  "/login",
  "/affiliate",
  "/cart",
  "/shops",
  "/signup",
] as const

test.describe("public flows", () => {
  for (const path of PUBLIC_PAGE_PATHS) {
    test(`GET ${path} is not 404`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 5 })
      expect(res.status(), `${path} returned ${res.status()}`).not.toBe(404)
    })
  }

  test("GET /api/categories returns JSON", async ({ request }) => {
    const res = await request.get("/api/categories")
    expect(res.ok()).toBeTruthy()
    expect(res.headers()["content-type"] ?? "").toMatch(/json/i)
  })

  test("login selector page renders", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("heading", { name: /Sign in to Affisell|Connexion Affisell/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /I'm a Creator|Je suis Créateur/i })).toBeVisible()
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

  test("legacy /marketplace redirects guests to home explorer", async ({ page }) => {
    await page.goto("/marketplace")
    await expect(page).toHaveURL(/#explorer/)
    await expect(page.locator("#explorer")).toBeVisible({ timeout: 30_000 })
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
