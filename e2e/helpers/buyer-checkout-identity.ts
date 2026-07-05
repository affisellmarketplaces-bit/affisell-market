import { expect, type BrowserContext, type Page } from "@playwright/test"

import { GUEST_CART_KEY, type GuestCartItem } from "@/lib/guest-cart"

export const E2E_CHECKOUT_GUEST_EMAIL = "e2e-buyer@example.com"
export const E2E_CHECKOUT_GUEST_PHONE = "0612345678"
export const E2E_CHECKOUT_SUCCESS_PATH = "/success?session_id=e2e_test_session"

export type IdentifiedCheckoutCapture = {
  channel?: string
  email?: string
  phone?: string
  checkout?: {
    items?: Array<{ productId?: string; qty?: number }>
    productId?: string
    affiliateProductId?: string
  }
}

export type BuyerCheckoutStubState = {
  identifiedCalls: number
  buyerIdentifyCalls: number
  lastIdentifiedBody: IdentifiedCheckoutCapture | null
}

export function buyerCheckoutPdpConfigured(): boolean {
  const slug = process.env.PLAYWRIGHT_PUBLIC_SHOP_SLUG?.trim()
  const listingId = process.env.PLAYWRIGHT_PUBLIC_LISTING_ID?.trim()
  return Boolean(slug && listingId)
}

export function buyerCheckoutPdpPath(): string {
  const slug = process.env.PLAYWRIGHT_PUBLIC_SHOP_SLUG?.trim() ?? ""
  const listingId = process.env.PLAYWRIGHT_PUBLIC_LISTING_ID?.trim() ?? ""
  return `/shops/${slug}/product/${listingId}`
}

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

export async function seedGuestCart(page: Page, items: GuestCartItem[]): Promise<void> {
  await page.addInitScript(
    ({ key, lines }) => {
      window.localStorage.setItem(key, JSON.stringify(lines))
    },
    { key: GUEST_CART_KEY, lines: items }
  )
}

export const defaultGuestCartItem = (): GuestCartItem => ({
  productId:
    process.env.PLAYWRIGHT_PUBLIC_LISTING_ID?.trim() || "e2e-listing-checkout",
  qty: 1,
  title: "E2E Checkout Product",
  price: 29.99,
  imageUrl: "/placeholder.png",
  sellerName: "E2E Store",
})

export async function stubBuyerCheckoutApis(
  page: Page,
  state: BuyerCheckoutStubState,
  opts?: { successPath?: string }
): Promise<void> {
  const successPath = opts?.successPath ?? E2E_CHECKOUT_SUCCESS_PATH

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: null }),
    })
  })

  await page.route("**/api/cart", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      })
      return
    }
    await route.continue()
  })

  await page.route("**/api/market/visitor-region", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ country: "FR", checkoutAvailable: true }),
    })
  })

  await page.route("**/api/auth/buyer-identify", async (route) => {
    state.buyerIdentifyCalls += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, sessionEstablished: true }),
    })
  })

  await page.route("**/api/checkout/identified", async (route) => {
    state.identifiedCalls += 1
    state.lastIdentifiedBody = (route.request().postDataJSON() ?? {}) as IdentifiedCheckoutCapture
    // Brief delay so the handoff overlay is observable before redirect.
    await new Promise((resolve) => setTimeout(resolve, 450))
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: successPath }),
    })
  })

  await page.route("**/api/stripe/verify-session**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        paid: true,
        fulfilled: true,
        orderId: "e2e-order-checkout",
        orderIds: ["e2e-order-checkout"],
        affiliateProductId: process.env.PLAYWRIGHT_PUBLIC_LISTING_ID?.trim() || "e2e-listing-checkout",
        amountTotal: 2999,
        currency: "eur",
        productName: "E2E Checkout Product",
        productImageUrl: "/placeholder.png",
      }),
    })
  })

  await page.route("**/api/auth/post-checkout-buyer", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ checkoutMagic: "e2e-checkout-magic" }),
    })
  })
}

export async function openGuestCartCheckout(page: Page): Promise<void> {
  await page.goto("/cart")
  await expect(page.getByRole("heading", { name: /cart|panier/i })).toBeVisible({ timeout: 20_000 })
  const cta = page.getByTestId("cart-checkout-cta")
  if (await cta.isVisible().catch(() => false)) {
    await cta.click()
  } else {
    await page
      .getByRole("button", { name: /validate purchase|valider mon achat/i })
      .click()
  }
  await expect(page.getByTestId("checkout-identity-sheet")).toBeVisible({ timeout: 10_000 })
}

export async function submitCheckoutIdentity(
  page: Page,
  opts: { channel: "email" | "phone"; value: string }
): Promise<void> {
  if (opts.channel === "phone") {
    await page.getByTestId("checkout-identity-phone-tab").click()
    await page.getByTestId("checkout-identity-phone").fill(opts.value)
  } else {
    await page.getByTestId("checkout-identity-email").fill(opts.value)
  }
  await page.getByTestId("checkout-identity-submit").click()
}

export async function expectCheckoutHandoff(page: Page): Promise<void> {
  await expect(page.getByTestId("checkout-payment-handoff")).toBeVisible({ timeout: 10_000 })
}
