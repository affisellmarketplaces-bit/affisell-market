import { describe, expect, it } from "vitest"

import {
  buildHauteGammeBuyerTagline,
  buildHauteGammeHeroTitle,
  buildHauteGammeMerchantTagline,
  getHauteGammeDesignById,
  HAUTE_GAMME_DESIGNS,
  isAffiliateFacingTagline,
  parseBrandStudioSnapshot,
  resolvePublicBoutiqueTagline,
  resolveStableDesignIndex,
  sanitizePublicBoutiqueTagline,
  isHauteGammeDesignId,
} from "@/lib/boutique/haute-gamme-themes-shared"
import { matchVibeToDesign } from "@/lib/boutique/haute-gamme-themes-shared"

describe("haute-gamme-themes", () => {
  it("exposes 6 premium designs", () => {
    expect(HAUTE_GAMME_DESIGNS).toHaveLength(6)
    expect(getHauteGammeDesignById("eclipse")?.name).toBe("ECLIPSE")
  })

  it("matchVibeToDesign maps luxury to ATELIER", () => {
    expect(matchVibeToDesign("minimalist luxury tech creator store").id).toBe("atelier")
  })

  it("matchVibeToDesign maps neon gaming to CYBER", () => {
    expect(matchVibeToDesign("neon cyberpunk gaming vibe").id).toBe("cyber")
  })

  it("matchVibeToDesign maps minimal to MINIMAL", () => {
    expect(matchVibeToDesign("clean minimal white essentials").id).toBe("minimal")
  })

  it("builds merchant tagline for affiliates only", () => {
    const tagline = buildHauteGammeMerchantTagline({
      vibe: "neon cyberpunk gaming lab",
      storeLabel: "Ecom Store",
    })
    expect(tagline).toContain("your audience will love")
    expect(tagline).toContain("neon cyberpunk gaming lab")
    expect(isAffiliateFacingTagline(tagline)).toBe(true)
  })

  it("builds buyer tagline without affiliate jargon", () => {
    const design = getHauteGammeDesignById("cyber")!
    const tagline = buildHauteGammeBuyerTagline({
      design,
      storeLabel: "Ecom Store",
    })
    expect(tagline).toContain("Ecom Store")
    expect(tagline).toContain("Future archive 001")
    expect(isAffiliateFacingTagline(tagline)).toBe(false)
    expect(tagline).not.toContain("your audience")
  })

  it("migrates legacy affiliate tagline to buyer copy on read", () => {
    const design = getHauteGammeDesignById("cyber")!
    const snapshot = parseBrandStudioSnapshot(
      {
        designId: design.id,
        vibe: "neon cyberpunk gaming lab",
        tagline:
          "Ecom Store — neon cyberpunk gaming lab, future archive 001, fuchsia cyan glitch, creator tech picks your audience will love.",
        palette: design.palette,
        typography: design.typography,
        heroTitle: "✦ Ecom Store ✦",
        designIndex: 816,
        updatedAt: "2026-08-15T12:00:00.000Z",
      },
      { storeLabel: "Ecom Store" }
    )

    expect(snapshot?.merchantTagline).toContain("your audience will love")
    expect(snapshot?.buyerTagline).toContain("Future archive 001")
    expect(isAffiliateFacingTagline(snapshot?.buyerTagline ?? "")).toBe(false)
  })

  it("resolvePublicBoutiqueTagline never returns affiliate copy", () => {
    const design = getHauteGammeDesignById("cyber")!
    const brandStudio = parseBrandStudioSnapshot(
      {
        designId: design.id,
        vibe: "neon",
        tagline: "Ecom Store — neon picks your audience will love.",
        palette: design.palette,
        typography: design.typography,
        heroTitle: "✦ Ecom Store ✦",
        designIndex: 816,
        updatedAt: "2026-08-15T12:00:00.000Z",
      },
      { storeLabel: "Ecom Store" }
    )

    const publicTagline = resolvePublicBoutiqueTagline({
      brandStudio,
      boutiqueAiTagline: "Ecom Store — neon picks your audience will love.",
      storeDescription: null,
      storeLabel: "Ecom Store",
    })

    expect(publicTagline).not.toBeNull()
    expect(isAffiliateFacingTagline(publicTagline ?? "")).toBe(false)
  })

  it("builds hero title with ornament", () => {
    const design = getHauteGammeDesignById("eclipse")!
    expect(buildHauteGammeHeroTitle({ storeLabel: "Ecom Store", typography: design.typography })).toBe(
      "★ Ecom Store ★"
    )
  })

  it("resolveStableDesignIndex is stable 1-1024", () => {
    const a = resolveStableDesignIndex("ecom-store", "eclipse")
    const b = resolveStableDesignIndex("ecom-store", "eclipse")
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(1)
    expect(a).toBeLessThanOrEqual(1024)
  })

  it("sanitizePublicBoutiqueTagline strips affiliate copy", () => {
    const design = getHauteGammeDesignById("cyber")!
    const cleaned = sanitizePublicBoutiqueTagline({
      raw: "Ecom Store — neon picks your audience will love.",
      storeLabel: "Ecom Store",
      brandStudio: {
        designId: design.id,
        vibe: "neon",
        merchantTagline: "Ecom Store — neon picks your audience will love.",
        buyerTagline: "Ecom Store — Future archive 001 — tech & gaming curated for you.",
        palette: design.palette,
        typography: design.typography,
        heroTitle: "✦ Ecom Store ✦",
        designIndex: 816,
        updatedAt: "2026-08-15T12:00:00.000Z",
      },
    })
    expect(isAffiliateFacingTagline(cleaned)).toBe(false)
    expect(cleaned).toContain("Future archive 001")
  })

  it("isHauteGammeDesignId recognizes design ids", () => {
    expect(isHauteGammeDesignId("cyber")).toBe(true)
    expect(isHauteGammeDesignId("t-0816")).toBe(false)
  })
})
