import { expect, test, type Page } from "@playwright/test"

import {
  AFFILIATE_ONBOARDING_HUB_PATH,
  affiliateE2EConfigured,
  loginAsDemoAffiliate,
  openAffiliateOnboardingHub,
  dismissCookieBannerIfVisible,
  seedCookieConsent,
  stubAffiliateOnboardingApis,
} from "./helpers/affiliate-onboarding"

test.describe.configure({ mode: "serial" })

/**
 * Affiliate onboarding « 1er listing » E2E.
 *
 * Auth: Demo Lab 1-click (`DEMO_LAB_PASSWORD` in `.env.local` or CI env).
 * Enable full suite: `PLAYWRIGHT_AFFILIATE_E2E=1` (optional flag for shop-business-data parity).
 *
 * Run: `npm run test:e2e -- e2e/affiliate-first-listing-onboarding.spec.ts`
 */
test.describe("Affiliate first listing onboarding", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("guest hub redirects to affiliate login", async ({ page }) => {
    await page.goto(AFFILIATE_ONBOARDING_HUB_PATH)
    await page.waitForURL(/\/login\/affiliate/, { timeout: 20_000 })
    await expect(page).toHaveURL(/\/login\/affiliate/)
  })

  test.describe("authenticated Demo Lab affiliate", () => {
    test.beforeEach(async ({ page, context }) => {
      test.skip(
        !affiliateE2EConfigured(),
        "Set DEMO_LAB_PASSWORD (or DEMO_AFFILIATE_PASSWORD) in env — npm run demo:ensure"
      )
      await seedCookieConsent(context)
      await stubAffiliateOnboardingApis(page, { kycBlockedOnPublish: true })
      await loginAsDemoAffiliate(page)
    })

    test("onboarding hub shows coach banner and swipe deck", async ({ page }) => {
      await openAffiliateOnboardingHub(page)

      await expect(page.getByTestId("affiliate-first-listing-coach")).toContainText(
        /5-minute launch|Lancement 5 min/i
      )
      await expect(page.getByTestId("affiliate-first-listing-coach")).toContainText(
        /first listing|première fiche/i
      )
      await expect(page.getByTestId("affiliate-swipe-dock-left")).toBeVisible()
      await expect(page.getByTestId("affiliate-swipe-dock-right")).toBeVisible()
    })

    test("swipe right opens onboarding listing studio", async ({ page }) => {
      await openAffiliateOnboardingHub(page)

      await page.getByTestId("affiliate-swipe-dock-right").click()
      await expect(page.getByTestId("affiliate-listing-builder-modal")).toBeVisible({
        timeout: 15_000,
      })
      await expect(
        page.getByTestId("affiliate-listing-builder-modal").getByText(/First listing|Première fiche/i)
      ).toBeVisible()
      await expect(
        page.getByTestId("affiliate-listing-builder-modal").getByRole("heading", {
          name: "E2E Affiliate Alpha",
        })
      ).toBeVisible()
      await expect(page.getByText(/1 Price & title|1 Prix & titre/i)).toBeVisible()
    })

    test("publish while KYC pending saves draft and closes studio", async ({ page }) => {
      let publishAttempts = 0
      await page.route("**/api/affiliate/products/add", async (route) => {
        const body = (route.request().postDataJSON() ?? {}) as { saveDraft?: boolean }
        publishAttempts += 1
        if (body.saveDraft !== true) {
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

      await openAffiliateOnboardingHub(page)
      await page.getByTestId("affiliate-swipe-dock-right").click()
      await expect(page.getByTestId("affiliate-listing-builder-modal")).toBeVisible({
        timeout: 15_000,
      })

      await dismissCookieBannerIfVisible(page)
      await page
        .getByTestId("affiliate-listing-builder-modal")
        .getByRole("button", { name: /Publish listing|Publier la fiche/i })
        .click({ force: true })

      await expect(page.getByTestId("affiliate-listing-builder-modal")).toBeHidden({
        timeout: 15_000,
      })
      expect(publishAttempts).toBeGreaterThanOrEqual(2)
      await expect(page.getByRole("heading", { name: "E2E Affiliate Beta" })).toBeVisible({
        timeout: 10_000,
      })
    })

    test("pointer drag right opens onboarding studio", async ({ page }) => {
      await openAffiliateOnboardingHub(page)
      await dragAffiliateSwipeCard(page, "right")
      await expect(page.getByTestId("affiliate-listing-builder-modal")).toBeVisible({
        timeout: 15_000,
      })
    })
  })
})

async function dragAffiliateSwipeCard(page: Page, direction: "left" | "right") {
  const card = page.getByTestId("affiliate-swipe-drag-surface")
  await expect(card).toBeVisible()
  const box = await card.boundingBox()
  if (!box) throw new Error("affiliate-swipe-drag-surface has no bounding box")

  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const deltaX = direction === "right" ? 240 : -240

  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + deltaX, cy, { steps: 16 })
  await page.mouse.up()
}
