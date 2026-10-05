import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { shouldMinimizeOnLinkClick } from "@/components/dona/dona-navigation"
import { DonaSignupCta } from "@/components/dona/dona-signup-cta"
import type { DonaSignupIntent } from "@/lib/dona/dona-signup-intent"
import type { AppLocale } from "@/lib/i18n-locale"

function render(intent: DonaSignupIntent, locale: AppLocale = "fr"): string {
  return renderToStaticMarkup(createElement(DonaSignupCta, { intent, locale }))
}
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])

describe("DonaSignupCta", () => {
  it("a supplier gets the supplier SIGN-UP as the main button and their login as the secondary link", () => {
    const html = render("supplier")
    expect(hrefs(html)).toEqual(["/signup/supplier", "/login/supplier"])
    expect(html).toContain("Créer mon compte fournisseur")
    expect(html).toContain("J&#x27;ai déjà un compte")
  })

  it("a reseller gets the reseller sign-up", () => {
    expect(hrefs(render("reseller"))).toEqual(["/signup/affiliate", "/login/affiliate"])
    expect(render("reseller")).toContain("Créer ma vitrine revendeur")
  })

  it("an undecided visitor sees every door, reseller first", () => {
    const html = render("any")
    expect(hrefs(html).filter((h) => h!.startsWith("/signup/"))).toEqual([
      "/signup/affiliate",
      "/signup/supplier",
      "/signup/customer",
    ])
    expect(html).toContain("Choisissez votre profil")
  })

  it("speaks the visitor's language and falls back to English for a missing key", () => {
    expect(render("supplier", "en")).toContain("Create my supplier account")
    expect(render("supplier", "de")).toContain("Lieferantenkonto erstellen")
    expect(render("reseller", "zh")).toContain("创建我的分销店铺")
    for (const locale of ["fr", "en", "de", "es", "it", "nl", "pl", "zh"] as const) {
      expect(render("any", locale), locale).not.toContain("donaWidget.public.signupCta")
    }
  })

  it("buttons are big enough to tap", () => {
    expect(render("supplier")).toContain("min-h-11")
  })
})

describe("shouldMinimizeOnLinkClick", () => {
  const click = (over: Partial<Parameters<typeof shouldMinimizeOnLinkClick>[0]> = {}) => ({
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...over,
  })

  it("a plain left click stays in this tab, so the chat steps aside to reveal the page", () => {
    expect(shouldMinimizeOnLinkClick(click())).toBe(true)
  })

  it("new-tab / new-window / middle clicks and already-handled clicks leave the chat open", () => {
    expect(shouldMinimizeOnLinkClick(click({ metaKey: true }))).toBe(false)
    expect(shouldMinimizeOnLinkClick(click({ ctrlKey: true }))).toBe(false)
    expect(shouldMinimizeOnLinkClick(click({ shiftKey: true }))).toBe(false)
    expect(shouldMinimizeOnLinkClick(click({ altKey: true }))).toBe(false)
    expect(shouldMinimizeOnLinkClick(click({ button: 1 }))).toBe(false)
    expect(shouldMinimizeOnLinkClick(click({ defaultPrevented: true }))).toBe(false)
  })
})
