import { expect, test } from "@playwright/test"

test.describe("public flows", () => {
  test("GET /api/categories returns JSON", async ({ request }) => {
    const res = await request.get("/api/categories")
    expect(res.ok()).toBeTruthy()
    expect(res.headers()["content-type"] ?? "").toMatch(/json/i)
  })

  test("auth sign-in page renders", async ({ page }) => {
    await page.goto("/auth/signin")
    await expect(page.getByRole("heading", { name: "Affisell", exact: true })).toBeVisible()
    await expect(page.getByText("Sign in with your email")).toBeVisible()
  })

  test("/login redirects to sign-in", async ({ page }) => {
    await page.goto("/login?callbackUrl=%2Fdashboard%2Fsupplier")
    await expect(page).toHaveURL(/\/auth\/signin/)
    await expect(page).toHaveURL(/callbackUrl=%2Fdashboard%2Fsupplier/)
  })

  test("discover feed shell loads", async ({ page }) => {
    await page.goto("/discover")
    await expect(page).toHaveURL(/\/discover/)
    await expect(page.locator(".bg-black").first()).toBeVisible({ timeout: 30_000 })
  })

  test("marketplace heading", async ({ page }) => {
    await page.goto("/marketplace")
    await expect(page.getByRole("heading", { level: 1, name: "Marketplace" })).toBeVisible()
  })

  test("GET /api/cart returns JSON (guest)", async ({ request }) => {
    const res = await request.get("/api/cart")
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(Array.isArray(data)).toBeTruthy()
  })

  test("wishlist sends guests to sign-in", async ({ page }) => {
    await page.goto("/wishlist")
    await expect(page).toHaveURL(/\/auth\/signin/)
  })
})
