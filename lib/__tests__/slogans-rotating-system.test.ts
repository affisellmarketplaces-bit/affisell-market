import { describe, expect, it } from "vitest"

import {
  longestSloganPhrase,
  resolveSloganCopy,
  SLOGAN_SYSTEM,
} from "@/lib/slogans/rotating-system"

describe("slogan rotating system", () => {
  it("defines three personas with distinct emotions and intervals", () => {
    expect(SLOGAN_SYSTEM.buyer.emotion).toBe("TRUST")
    expect(SLOGAN_SYSTEM.reseller.emotion).toBe("PROFIT")
    expect(SLOGAN_SYSTEM.supplier.emotion).toBe("SCALE")
    expect(SLOGAN_SYSTEM.buyer.interval).toBeGreaterThan(SLOGAN_SYSTEM.reseller.interval)
    expect(SLOGAN_SYSTEM.supplier.route).toBe("/become-supplier")
  })

  it("keeps SEO canonical strings stable", () => {
    expect(SLOGAN_SYSTEM.buyer.canonical).toMatch(/trust/i)
    expect(SLOGAN_SYSTEM.reseller.canonical).toMatch(/profits/i)
    expect(SLOGAN_SYSTEM.supplier.canonical).toMatch(/income/i)
  })

  it("sizes invisible slot from longest phrase", () => {
    const phrases = ["a", "abcdefgh", "xy"]
    expect(longestSloganPhrase(phrases)).toBe("abcdefgh")
  })

  it("allows locale overrides without mutating defaults", () => {
    const copy = resolveSloganCopy("buyer", {
      base: "Des boutiques de confiance.",
      rotatifs: ["Produits vérifiés."],
    })
    expect(copy.base).toMatch(/confiance/)
    expect(copy.rotatifs).toHaveLength(1)
    expect(SLOGAN_SYSTEM.buyer.rotatifs.length).toBeGreaterThan(1)
  })
})
