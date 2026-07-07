import { describe, expect, it } from "vitest"

import en from "@/messages/en.json"
import fr from "@/messages/fr.json"

describe("public marketplace i18n (Lot I)", () => {
  it("uses reseller copy on nav, shops and discovery", () => {
    expect(fr.PublicNav.creatorStores).toMatch(/revendeur/i)
    expect(en.PublicNav.creatorStores).toMatch(/reseller/i)
    expect(fr.shops.title).toMatch(/revendeur/i)
    expect(en.shops.title).toMatch(/reseller/i)
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

  it("keeps hero copy unchanged (Lot P3.5 excluded)", () => {
    expect(fr.home.hero.titleHighlight).toMatch(/créateur/i)
    expect(en.home.hero.titleHighlight).toMatch(/creator/i)
  })
})
