import { describe, expect, it } from "vitest"

import en from "@/messages/en.json"
import fr from "@/messages/fr.json"

describe("public marketplace i18n (Lot I)", () => {
  it("uses trust copy for buyer-facing nav and shops directory", () => {
    expect(fr.PublicNav.trustedStores).toMatch(/confiance/i)
    expect(en.PublicNav.trustedStores).toMatch(/trusted/i)
    expect(fr.PublicNav.resellerStores).toMatch(/revendeur/i)
    expect(en.PublicNav.resellerStores).toMatch(/reseller/i)
    expect(fr.PublicNav.creatorStores).toMatch(/confiance/i)
    expect(en.PublicNav.creatorStores).toMatch(/trusted/i)
    expect(fr.shops.title).toMatch(/confiance/i)
    expect(en.shops.title).toMatch(/trusted/i)
    expect(fr.discovery.creators).toMatch(/revendeur/i)
    expect(en.discovery.creators).toMatch(/reseller/i)
  })

  it("uses reseller copy on marketplace browse and footer", () => {
    expect(fr.marketplace.browse.subtitleBuyer).toMatch(/revendeur/i)
    expect(en.marketplace.browse.placeholderBuyer).toMatch(/reseller/i)
    expect(fr.footer.global.becomeCreator).toMatch(/revendeur/i)
    expect(en.footer.global.becomeCreator).toMatch(/reseller/i)
    expect(fr.footer.brand.tagline).toMatch(/revendeur/i)
    expect(en.footer.brand.tagline).toMatch(/reseller/i)
  })

  it("uses buyer-trust hero copy (B2C), not creator slogan", () => {
    expect(fr.home.hero.title).toMatch(/confiance/i)
    expect(fr.home.hero.titleHighlight).toMatch(/vérifiés/i)
    expect(en.home.hero.title).toMatch(/trust/i)
    expect(en.home.hero.titleHighlight).toMatch(/verified/i)
    expect(en.home.hero.ctaPrimary).toMatch(/trusted stores/i)
    expect(fr.home.hero.ctaPrimary).toMatch(/boutiques de confiance/i)
    expect(en.home.hero.creatorLink).toMatch(/reseller/i)
    expect(fr.home.hero.creatorLink).toMatch(/revendeur/i)
    expect(en.home.hero.sub).toMatch(/Verified stores/i)
    expect(fr.home.hero.sub).toMatch(/Boutiques vérifiées/i)
    expect(en.home.meta.title).toMatch(/Trusted stores/i)
  })
})
