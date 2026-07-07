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

  it("exposes shared auth placeholders", () => {
    expect(fr.auth.emailPlaceholder).toBeTruthy()
    expect(en.auth.passwordPlaceholder).toBe("••••••••")
  })
})
