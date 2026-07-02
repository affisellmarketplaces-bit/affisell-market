import { expect, test } from "@playwright/test"

import {
  buyerCheckoutPdpConfigured,
  buyerCheckoutPdpPath,
  defaultGuestCartItem,
  E2E_CHECKOUT_GUEST_EMAIL,
  E2E_CHECKOUT_GUEST_PHONE,
  expectCheckoutHandoff,
  openGuestCartCheckout,
  seedCookieConsent,
  seedGuestCart,
  stubBuyerCheckoutApis,
  submitCheckoutIdentity,
  type BuyerCheckoutStubState,
} from "./helpers/buyer-checkout-identity"

test.describe.configure({ mode: "serial" })

/**
 * Buyer checkout identity → Stripe handoff E2E (Tier 4 D).
 * APIs stubbed — no real Stripe or DB writes required for cart flow.
 *
 * Run: `npm run test:e2e -- e2e/buyer-checkout-identity.spec.ts`
 *
 * Optional PDP buy-now: set PLAYWRIGHT_PUBLIC_SHOP_SLUG + PLAYWRIGHT_PUBLIC_LISTING_ID.
 */
test.describe("Buyer checkout identity", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  let stubState: BuyerCheckoutStubState

  test.beforeEach(async ({ page, context }) => {
    stubState = { identifiedCalls: 0, buyerIdentifyCalls: 0, lastIdentifiedBody: null }
    await seedCookieConsent(context)
    await seedGuestCart(page, [defaultGuestCartItem()])
    await stubBuyerCheckoutApis(page, stubState)
  })

  test("guest cart: email → one-shot identified checkout → success redirect", async ({ page }) => {
    await openGuestCartCheckout(page)
    await submitCheckoutIdentity(page, { channel: "email", value: E2E_CHECKOUT_GUEST_EMAIL })

    await Promise.all([
      expectCheckoutHandoff(page),
      page.waitForURL(/\/success\?session_id=e2e_test_session/, { timeout: 20_000 }),
    ])

    expect(stubState.identifiedCalls).toBe(1)
    expect(stubState.buyerIdentifyCalls).toBe(0)
    expect(stubState.lastIdentifiedBody?.channel).toBe("email")
    expect(stubState.lastIdentifiedBody?.email).toBe(E2E_CHECKOUT_GUEST_EMAIL)
    expect(stubState.lastIdentifiedBody?.checkout?.items?.length).toBeGreaterThan(0)
  })

  test("guest cart: phone channel uses identified fast path", async ({ page }) => {
    await openGuestCartCheckout(page)
    await submitCheckoutIdentity(page, { channel: "phone", value: E2E_CHECKOUT_GUEST_PHONE })

    await Promise.all([
      expectCheckoutHandoff(page),
      page.waitForURL(/\/success\?session_id=e2e_test_session/, { timeout: 20_000 }),
    ])

    expect(stubState.identifiedCalls).toBe(1)
    expect(stubState.lastIdentifiedBody?.channel).toBe("phone")
    expect(stubState.lastIdentifiedBody?.phone).toBe(E2E_CHECKOUT_GUEST_PHONE)
  })

  test.describe("product buy-now (live listing)", () => {
    test.beforeEach(() => {
      test.skip(
        !buyerCheckoutPdpConfigured(),
        "Set PLAYWRIGHT_PUBLIC_SHOP_SLUG and PLAYWRIGHT_PUBLIC_LISTING_ID for PDP buy-now."
      )
    })

    test("PDP buy-now opens identity then identified checkout", async ({ page }) => {
      await page.goto(buyerCheckoutPdpPath())
      await expect(
        page.getByRole("button", { name: /buy now|acheter/i }).first()
      ).toBeVisible({ timeout: 45_000 })

      await page.getByRole("button", { name: /buy now|acheter/i }).first().click()
      await expect(page.getByTestId("checkout-identity-sheet")).toBeVisible({ timeout: 15_000 })

      await submitCheckoutIdentity(page, { channel: "email", value: E2E_CHECKOUT_GUEST_EMAIL })
      await Promise.all([
        expectCheckoutHandoff(page),
        page.waitForURL(/\/success\?session_id=e2e_test_session/, { timeout: 25_000 }),
      ])

      expect(stubState.identifiedCalls).toBe(1)
      expect(stubState.buyerIdentifyCalls).toBe(0)
      const checkout = stubState.lastIdentifiedBody?.checkout
      const listingId = process.env.PLAYWRIGHT_PUBLIC_LISTING_ID?.trim()
      expect(
        checkout?.productId === listingId ||
          checkout?.affiliateProductId === listingId ||
          checkout?.items?.some((row) => row.productId === listingId)
      ).toBeTruthy()
    })
  })
})
