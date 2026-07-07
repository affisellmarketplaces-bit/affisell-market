import { describe, expect, it } from "vitest"

import en from "@/messages/en.json"
import fr from "@/messages/fr.json"

describe("auth public i18n (Lot H)", () => {
  it("exposes reseller login selector copy in FR/EN", () => {
    expect(fr.auth.loginSelector.creatorTitle).toMatch(/revendeur/i)
    expect(en.auth.loginSelector.creatorTitle).toMatch(/reseller/i)
  })

  it("exposes agent portal and signup consent keys", () => {
    expect(fr.auth.portal.agent.title).toBeTruthy()
    expect(en.auth.portal.agent.title).toBeTruthy()
    expect(fr.legal.signupConsent.acceptCgu).toContain("<cgu>")
    expect(en.legal.signupConsent.acceptPrivacy).toContain("<privacy>")
    expect(fr.auth.signupSupplier.inviteBanner).toBeTruthy()
    expect(en.auth.marketplaceBuyer.acceptTermsError).toBeTruthy()
  })

  it("exposes reseller signup chooser and merchant auth copy in FR/EN", () => {
    expect(fr.auth.signupChooser.affiliateTitle).toMatch(/revendeur/i)
    expect(en.auth.signupChooser.affiliateTitle).toMatch(/reseller/i)
    expect(fr.auth.signupAffiliate.title).toMatch(/revendeur/i)
    expect(en.auth.signupAffiliate.hasAccount).toMatch(/reseller/i)
    expect(fr.auth.signupSupplier.subtitle).toMatch(/revendeurs/i)
    expect(en.auth.merchantLegal.titleAffiliate).toMatch(/reseller/i)
  })
})
