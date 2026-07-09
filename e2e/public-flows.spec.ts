import { expect, test } from "@playwright/test"

/** Core marketing and buyer routes — must not 404 (next-intl vs static segment regression). */
const PUBLIC_PAGE_PATHS = [
  "/",
  "/agent",
  "/creators",
  "/partners",
  "/enterprise",
  "/contact",
  "/faq",
  "/discover",
  "/auctions",
  "/luxe",
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

  test("GET /affiliate serves marketing landing (no redirect to /sell)", async ({ request }) => {
    const res = await request.get("/affiliate", { maxRedirects: 0 })
    expect(res.status()).toBe(200)
    expect(res.headers().location ?? "").not.toMatch(/\/sell/)
    const html = await res.text()
    expect(html).toMatch(/Fixez vos prix/i)
  })

  test("GET /api/categories returns JSON", async ({ request }) => {
    const res = await request.get("/api/categories")
    expect(res.ok()).toBeTruthy()
    expect(res.headers()["content-type"] ?? "").toMatch(/json/i)
  })

  test("login selector page renders", async ({ page }) => {
    await page.goto("/login")
    await expect(
      page.getByRole("heading", {
        name: /Affisell professional sign-in|Espace professionnel Affisell|Connexion Affisell/i,
      })
    ).toBeVisible()
    await expect(page.getByRole("link", { name: /I'm a reseller|Je suis revendeur/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /I'm a Supplier|Je suis Fournisseur/i })).toBeVisible()
    await expect(
      page.getByRole("link", { name: /Track my order|Suivre ma commande/i })
    ).toHaveAttribute("href", "/track-order")
    await expect(
      page.getByRole("link", { name: /Customer sign in|Connexion compte client/i })
    ).toHaveCount(0)
  })

  test("legacy /auth/signin redirects to /login", async ({ page }) => {
    await page.goto("/auth/signin")
    await expect(page).toHaveURL(/\/login/)
  })

  test("discover feed shell loads", async ({ page }) => {
    await page.goto("/discover")
    await expect(page).toHaveURL(/\/discover/)
    await expect(page.getByTestId("affisell-pulse")).toBeVisible({ timeout: 30_000 })
  })

  test("legacy /marketplace redirects guests to home explorer", async ({ page }) => {
    await page.goto("/marketplace")
    await expect(page).toHaveURL(/#explorer/)
    await expect(page.locator("#explorer")).toBeVisible({ timeout: 30_000 })
  })

  test("legacy /marketplace?q= keeps search on guest redirect", async ({ page }) => {
    await page.goto("/marketplace?q=chaussures")
    await expect(page).toHaveURL(/\?q=chaussures/)
    await expect(page).toHaveURL(/#explorer/)
  })

  test("hero search navigates to home explorer with query", async ({ page }) => {
    await page.goto("/")
    const heroSearch = page.locator("#buyer-hero-search")
    await expect(heroSearch).toBeVisible()
    await heroSearch.fill("chaussures")
    await page.locator("form:has(#buyer-hero-search) button[type='submit']").click()
    await expect(page).toHaveURL(/\?q=chaussures/)
    await expect(page).toHaveURL(/#explorer/)
    await expect(page.locator("#explorer")).toBeVisible({ timeout: 30_000 })
  })

  test("GET /home redirects to home", async ({ request }) => {
    const res = await request.get("/home", { maxRedirects: 0 })
    expect([301, 302, 307, 308]).toContain(res.status())
    const location = res.headers().location ?? ""
    expect(location).toMatch(/\/$|\/en$|\/fr$/)
  })

  test("luxe atelier shell loads", async ({ page }) => {
    await page.goto("/luxe")
    await expect(page).toHaveURL(/\/luxe/)
    await expect(page.getByTestId("luxe-atelier")).toBeVisible({ timeout: 30_000 })
  })

  test("GET /api/luxe returns JSON", async ({ request }) => {
    const res = await request.get("/api/luxe")
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(Array.isArray(data.pieces)).toBeTruthy()
  })

  test("auction arena shell loads", async ({ page }) => {
    await page.goto("/auctions")
    await expect(page).toHaveURL(/\/auctions/)
    await expect(page.getByTestId("auction-arena")).toBeVisible({ timeout: 30_000 })
  })

  test("GET /api/auctions returns JSON", async ({ request }) => {
    const res = await request.get("/api/auctions")
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(Array.isArray(data.lots)).toBeTruthy()
  })

  test("GET /api/cart returns JSON (guest)", async ({ request }) => {
    const res = await request.get("/api/cart")
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(Array.isArray(data)).toBeTruthy()
  })

  test("wishlist page loads for guests", async ({ page }) => {
    await page.goto("/wishlist")
    await expect(page).toHaveURL(/\/wishlist/)
    await expect(page.getByRole("heading", { name: /My favorites|Mes favoris/i })).toBeVisible()
  })
})
