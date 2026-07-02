import { expect, type BrowserContext, type Page } from "@playwright/test"

import {
  e2eAffiliateCatalogProductFixture,
  e2eAffiliateSwipeFixtureProducts,
} from "@/lib/e2e-affiliate-swipe-fixtures"

export const AFFILIATE_ONBOARDING_HUB_PATH =
  "/dashboard/affiliate/hub?mode=swipe&onboarding=1"

export function affiliateE2EConfigured(): boolean {
  return Boolean(
    process.env.DEMO_LAB_PASSWORD?.trim() || process.env.DEMO_AFFILIATE_PASSWORD?.trim()
  )
}

/** Pre-set consent so the cookie banner does not block modal CTAs on mobile. */
export async function seedCookieConsent(context: BrowserContext): Promise<void> {
  await context.addCookies([
    {
      name: "affisell_cookie_consent",
      value: "true",
      domain: "localhost",
      path: "/",
    },
  ])
}

export async function dismissCookieBannerIfVisible(page: Page): Promise<void> {
  const accept = page.getByRole("button", { name: /^Accepter$/i })
  if (await accept.isVisible().catch(() => false)) {
    await accept.click()
  }
}

/** 1-click Demo Lab login as affiliate (needs DEMO_LAB_PASSWORD in webServer env). */
export async function loginAsDemoAffiliate(page: Page): Promise<void> {
  await page.goto("/demo/affiliate")
  await dismissCookieBannerIfVisible(page)
  const enter = page.getByRole("button", { name: /enter demo|entrer.*d[ée]mo/i })
  await expect(enter).toBeVisible({ timeout: 20_000 })
  await enter.click()
  await page.waitForURL(/\/dashboard\/affiliate/, { timeout: 45_000 })
}

export async function stubAffiliateOnboardingApis(
  page: Page,
  opts?: { kycBlockedOnPublish?: boolean }
): Promise<void> {
  const products = e2eAffiliateSwipeFixtureProducts()
  const kycBlocked = opts?.kycBlockedOnPublish ?? true

  await page.route("**/api/affiliate/swipe-feed**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ products }),
    })
  })

  await page.route("**/api/affiliate/catalog-product/**", async (route) => {
    const url = new URL(route.request().url())
    const productId = decodeURIComponent(url.pathname.split("/").pop() ?? "")
    const product = e2eAffiliateCatalogProductFixture(productId)
    if (!product) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Not found" }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ product }),
    })
  })

  await page.route("**/api/affiliate/bootstrap", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        listings: [],
        storeSlug: "e2e-demo-affiliate",
        storeName: "E2E Demo Shop",
      }),
    })
  })

  await page.route("**/api/affiliate/swipes**", async (route) => {
    const method = route.request().method()
    if (method === "POST" || method === "DELETE") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      })
      return
    }
    await route.continue()
  })

  await page.route("**/api/affiliate/products/add", async (route) => {
    const body = (route.request().postDataJSON() ?? {}) as { saveDraft?: boolean }
    if (kycBlocked && body.saveDraft !== true) {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "merchant_verification_pending" }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "e2e-affiliate-listing-alpha" }),
    })
  })
}

export async function openAffiliateOnboardingHub(page: Page): Promise<void> {
  await page.goto(AFFILIATE_ONBOARDING_HUB_PATH)
  await dismissCookieBannerIfVisible(page)
  await expect(page.getByTestId("affiliate-first-listing-coach")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId("affiliate-swipe-feed")).toBeVisible()
  await expect(page.getByRole("heading", { name: "E2E Affiliate Alpha" })).toBeVisible({
    timeout: 15_000,
  })
}
