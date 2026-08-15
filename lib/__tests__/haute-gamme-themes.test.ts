import { describe, expect, it } from "vitest"

import {
  buildHauteGammeHeroTitle,
  buildHauteGammeTagline,
  getHauteGammeDesignById,
  HAUTE_GAMME_DESIGNS,
  parseBrandStudioSnapshot,
  resolveStableDesignIndex,
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

  it("builds tagline with vibe and store label", () => {
    const design = getHauteGammeDesignById("eclipse")!
    const tagline = buildHauteGammeTagline({
      design,
      vibe: "curated fashion",
      storeLabel: "Ecom Store",
    })
    expect(tagline).toContain("Ecom Store")
    expect(tagline).toContain("curated fashion")
  })

  it("builds hero title with ornament", () => {
    const design = getHauteGammeDesignById("eclipse")!
    expect(buildHauteGammeHeroTitle({ storeLabel: "Ecom Store", typography: design.typography })).toBe(
      "★ Ecom Store ★"
    )
  })

  it("parses persisted brand studio snapshot", () => {
    const design = getHauteGammeDesignById("atelier")!
    const snapshot = parseBrandStudioSnapshot({
      designId: design.id,
      vibe: "luxury",
      tagline: "ATELIER — luxury picks your audience will love.",
      palette: design.palette,
      typography: design.typography,
      heroTitle: "✦ Ecom Store ✦",
      designIndex: 42,
      updatedAt: "2026-08-15T12:00:00.000Z",
    })
    expect(snapshot?.designId).toBe("atelier")
    expect(snapshot?.designIndex).toBe(42)
  })

  it("resolveStableDesignIndex is stable 1-1024", () => {
    const a = resolveStableDesignIndex("ecom-store", "eclipse")
    const b = resolveStableDesignIndex("ecom-store", "eclipse")
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(1)
    expect(a).toBeLessThanOrEqual(1024)
  })
})
