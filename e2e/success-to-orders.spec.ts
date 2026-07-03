import { expect, test } from "@playwright/test"

import {
  defaultGuestCartItem,
  E2E_CHECKOUT_GUEST_EMAIL,
  E2E_CHECKOUT_SUCCESS_PATH,
  openGuestCartCheckout,
  seedCookieConsent,
  seedGuestCart,
  stubBuyerCheckoutApis,
  submitCheckoutIdentity,
  type BuyerCheckoutStubState,
} from "./helpers/buyer-checkout-identity"

test.describe.configure({ mode: "serial" })

/**
 * Post-checkout funnel — success screen → buyer orders hub.
 * Run: `npm run test:e2e -- e2e/success-to-orders.spec.ts`
 */
test.describe("Success → orders funnel", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  let stubState: BuyerCheckoutStubState

  test.beforeEach(async ({ page, context }) => {
    stubState = { identifiedCalls: 0, buyerIdentifyCalls: 0, lastIdentifiedBody: null }
    await seedCookieConsent(context)
    await seedGuestCart(page, [defaultGuestCartItem()])
    await stubBuyerCheckoutApis(page, stubState)
  })

  test("checkout success shows fulfilled UI and orders CTA", async ({ page }) => {
    await openGuestCartCheckout(page)
    await submitCheckoutIdentity(page, { channel: "email", value: E2E_CHECKOUT_GUEST_EMAIL })
    await expect(page).toHaveURL(/\/success\?session_id=e2e_test_session/, { timeout: 20_000 })

    await expect(page.locator(".affisell-public-nav--transaction")).toBeVisible()
    await expect(
      page.getByRole("heading", { name: /payment successful|paiement réussi/i })
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("success-view-orders").first()).toBeVisible()
    await expect(page.getByText(/E2E Checkout Product/i).first()).toBeVisible()
  })

  test("guest sign-in CTA routes to login with orders callback", async ({ page }) => {
    await page.goto(E2E_CHECKOUT_SUCCESS_PATH)
    await expect(
      page.getByRole("heading", { name: /payment successful|paiement réussi/i })
    ).toBeVisible({ timeout: 15_000 })

    const signIn = page.locator(
      'a[href="/login/customer?callbackUrl=/marketplace/account/orders"]'
    )
    await expect(signIn).toBeVisible()
    await signIn.click()
    await expect(page).toHaveURL(/\/login\/customer\?callbackUrl=/, { timeout: 15_000 })
  })

  test("success header back link targets orders hub", async ({ page }) => {
    await page.goto(E2E_CHECKOUT_SUCCESS_PATH)
    await expect(page.locator(".affisell-public-nav--transaction")).toBeVisible()

    const backLink = page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: /view my orders|voir mes commandes/i })
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute("href", "/marketplace/account/orders")
  })
})
