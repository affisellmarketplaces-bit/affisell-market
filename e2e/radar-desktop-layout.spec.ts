import { expect, test } from "@playwright/test"

import {
  affiliateE2EConfigured,
  loginAsDemoAffiliate,
  seedCookieConsent,
} from "./helpers/affiliate-onboarding"
import { radarPlanE2EConfigured, withDemoAffiliateRadarPlan } from "./helpers/radar-plan"

/**
 * Regression guard for a real bug: `/radar`'s shell (`components/radar/radar-app-shell.tsx`)
 * was hard-capped at `max-w-5xl` (1024px) with no wider breakpoint, so on a normal desktop
 * monitor the whole dashboard sat in a narrow column with the rest of the screen empty.
 * jsdom/RTL can't catch this (no real layout engine — `max-w-*` never resolves to a pixel
 * width), so this lives in Playwright, which renders in a real browser.
 *
 * The second test covers the same fix's effect on the Radar Pro view (the country grid's
 * `xl:grid-cols-8`), which needs the demo affiliate upgraded to the "pro" plan — see
 * `./helpers/radar-plan.ts` for why that mutation only ever targets DATABASE_URL_STAGING.
 *
 * Auth: Demo Lab 1-click (`DEMO_LAB_PASSWORD` in `.env.local` or CI env).
 * Run: `npm run test:e2e -- e2e/radar-desktop-layout.spec.ts`
 */
test.describe("Radar desktop layout", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test.beforeEach(async ({ context }) => {
    test.skip(
      !affiliateE2EConfigured(),
      "Set DEMO_LAB_PASSWORD (or DEMO_AFFILIATE_PASSWORD) in env — npm run demo:ensure"
    )
    await seedCookieConsent(context)
  })

  test("dashboard shell uses the wide container, not the old 1024px cap", async ({ page }) => {
    await loginAsDemoAffiliate(page)
    await page.goto("/radar?country=FR")

    const main = page.locator("main")
    await expect(main).toBeVisible({ timeout: 30_000 })

    const box = await main.boundingBox()
    expect(box, "main element should have a measurable layout box").not.toBeNull()
    // max-w-7xl = 1280px. Old bug was max-w-5xl = 1024px — this must clear that with margin.
    expect(box!.width).toBeGreaterThan(1100)
    expect(box!.width).toBeLessThan(1300)
  })

  test("country grid fills the wide container with 8 columns (Radar Pro view)", async ({
    page,
  }) => {
    test.skip(
      !radarPlanE2EConfigured(),
      "Set DATABASE_URL_STAGING in .env.local — this test mutates the demo affiliate's radar plan"
    )

    await withDemoAffiliateRadarPlan("pro", async () => {
      await loginAsDemoAffiliate(page)
      await page.goto("/radar?country=FR")

      const grid = page.locator("main .grid").first()
      await expect(grid).toBeVisible({ timeout: 30_000 })

      const columnCount = await grid.evaluate((el) => {
        const template = getComputedStyle(el).gridTemplateColumns
        return template.split(" ").filter(Boolean).length
      })
      expect(columnCount).toBe(8)
    })
  })
})
