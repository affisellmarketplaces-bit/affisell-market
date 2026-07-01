import { expect, test } from "@playwright/test"

test.describe.configure({ mode: "serial" })

const DEDICATED_HOST = "ecom-store.shops.localhost"
const devPort = process.env.PORT ?? "3001"

async function expectPaymentStripHonest(page: import("@playwright/test").Page) {
  const footer = page.locator("footer.affisell-site-footer")
  await footer.scrollIntoViewIfNeeded()
  const strip = footer.getByTestId("payment-methods-strip").locator(":visible").first()
  await expect(strip).toBeVisible()

  await expect(strip.getByTitle("Visa")).toBeVisible()
  await expect(strip.getByTitle("Klarna")).toBeVisible()
  await expect(strip).not.toContainText(/oney/i)
  await expect(strip).toContainText(/eligible|éligibles|Stripe/i)
}

test.describe("trust polish — footer payments", () => {
  test("home footer shows Stripe-aligned payment badges (no Oney)", async ({ page }) => {
    await page.goto("/")
    await expectPaymentStripHonest(page)
  })

  test("dedicated storefront trust footer shows same payment strip", async ({ page }) => {
    await page.goto(`http://${DEDICATED_HOST}:${devPort}/`, {
      waitUntil: "domcontentloaded",
    })
    await expectPaymentStripHonest(page)
  })
})

test.describe("trust polish — custom domain APIs", () => {
  test("resolve-host finds demo affiliate subdomain", async ({ request }) => {
    const res = await request.get(
      `/api/store/resolve-host?host=${encodeURIComponent(`${DEDICATED_HOST}:${devPort}`)}`
    )
    expect(res.ok()).toBeTruthy()
    const data = (await res.json()) as { found?: boolean; slug?: string; role?: string }
    expect(data.found).toBe(true)
    expect(data.slug).toBeTruthy()
    expect(data.role).toMatch(/AFFILIATE|affiliate/i)
  })

  test("resolve-host rejects empty host param", async ({ request }) => {
    const res = await request.get("/api/store/resolve-host?host=")
    expect(res.status()).toBe(400)
  })

  test("resolve-host returns not found for unknown host", async ({ request }) => {
    const res = await request.get("/api/store/resolve-host?host=unknown-domain.example.com")
    expect(res.status()).toBe(404)
  })

  test("verify-domain requires merchant session", async ({ request }) => {
    const res = await request.post("/api/store/verify-domain")
    expect(res.status()).toBe(401)
  })

  test("domain sync cron rejects invalid bearer when CRON_SECRET is set", async ({ request }) => {
    if (!process.env.CRON_SECRET?.trim()) {
      test.skip(true, "CRON_SECRET not set in this environment")
    }
    const res = await request.get("/api/cron/sync-store-vercel-domains", {
      headers: { Authorization: "Bearer invalid-token" },
    })
    expect(res.status()).toBe(401)
  })
})

test.describe("trust polish — brand studio theme on public shop", () => {
  test("dedicated storefront injects theme CSS variables", async ({ page }) => {
    await page.goto(`http://${DEDICATED_HOST}:${devPort}/`, {
      waitUntil: "domcontentloaded",
    })

    const primary = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--store-primary").trim()
    )
    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--store-accent").trim()
    )

    expect(primary).toMatch(/^#[0-9a-f]{3,8}$/i)
    expect(accent).toMatch(/^#[0-9a-f]{3,8}$/i)
  })

  test("storefront header renders on themed shop", async ({ page }) => {
    await page.goto(`http://${DEDICATED_HOST}:${devPort}/`, {
      waitUntil: "domcontentloaded",
    })

    await expect(
      page.getByRole("button", { name: /Browse categories|Parcourir les catégories/i })
    ).toBeVisible()
  })
})
