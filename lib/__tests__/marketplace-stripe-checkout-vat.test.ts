import { afterEach, describe, expect, it } from "vitest"

import {
  buildHtLineItem,
  isStripeAutomaticTaxEnabled,
  marketplaceCheckoutCgvConsentOptions,
  marketplaceCheckoutTaxOptions,
} from "@/lib/marketplace-stripe-checkout"

describe("marketplace-stripe-checkout VAT franchise", () => {
  const prevTax = process.env.STRIPE_AUTOMATIC_TAX
  const prevVat = process.env.COMPANY_VAT
  const prevAffVat = process.env.AFFISELL_TVA

  afterEach(() => {
    if (prevTax === undefined) delete process.env.STRIPE_AUTOMATIC_TAX
    else process.env.STRIPE_AUTOMATIC_TAX = prevTax
    if (prevVat === undefined) delete process.env.COMPANY_VAT
    else process.env.COMPANY_VAT = prevVat
    if (prevAffVat === undefined) delete process.env.AFFISELL_TVA
    else process.env.AFFISELL_TVA = prevAffVat
    delete process.env.NEXT_PUBLIC_COMPANY_VAT
  })

  it("defaults automatic_tax off under art. 293 B (no VAT number)", () => {
    delete process.env.STRIPE_AUTOMATIC_TAX
    delete process.env.COMPANY_VAT
    delete process.env.AFFISELL_TVA
    delete process.env.NEXT_PUBLIC_COMPANY_VAT

    expect(isStripeAutomaticTaxEnabled()).toBe(false)
    expect(marketplaceCheckoutTaxOptions()).toEqual({
      automatic_tax: { enabled: false },
    })
    const line = buildHtLineItem({
      name: "Test",
      images: [],
      linePaidCentsHt: 1000,
      qty: 1,
    })
    expect(line.price_data.tax_behavior).toBeUndefined()
  })

  it("enables automatic_tax when STRIPE_AUTOMATIC_TAX=1", () => {
    process.env.STRIPE_AUTOMATIC_TAX = "1"
    expect(isStripeAutomaticTaxEnabled()).toBe(true)
    expect(marketplaceCheckoutTaxOptions()).toEqual({
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
    })
    const line = buildHtLineItem({
      name: "Test",
      images: [],
      linePaidCentsHt: 1000,
      qty: 1,
    })
    expect(line.price_data.tax_behavior).toBe("exclusive")
  })

  it("requires Stripe Checkout CGV consent before charge", () => {
    const opts = marketplaceCheckoutCgvConsentOptions()
    expect(opts.consent_collection?.terms_of_service).toBe("required")
    const acceptance = opts.custom_text?.terms_of_service_acceptance
    expect(acceptance).toEqual(
      expect.objectContaining({
        message: expect.stringMatching(/\/legal\/cgv/),
      })
    )
  })

  const acceptanceMessage = (origin?: string): string | undefined => {
    const acceptance = marketplaceCheckoutCgvConsentOptions(origin).custom_text?.terms_of_service_acceptance
    return acceptance && typeof acceptance === "object" ? acceptance.message : undefined
  }

  it("keeps the Affisell wording on the platform origin", () => {
    // Platform checkouts are unchanged: brand in the sentence, link built from the configured app URL.
    expect(acceptanceMessage("https://affisell.com")).toMatch(
      /^J'accepte les Conditions générales de vente Affisell \(https?:\/\/[^)]+\/legal\/cgv\)\.$/
    )
  })

  it("links to the reseller's own host without the platform brand", () => {
    for (const origin of ["https://maison-lea.com", "https://maison-lea.shops.affisell.com/"]) {
      const message = acceptanceMessage(origin)
      expect(message).toBe(`J'accepte les Conditions générales de vente (${origin.replace(/\/$/, "")}/legal/cgv).`)
      // The sentence itself carries no brand (an auto subdomain's URL may legitimately sit under the platform domain).
      expect(message!.replace(/\(https?:\/\/[^)]+\)/, "")).not.toMatch(/affisell/i)
    }
  })
})
