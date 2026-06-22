import { describe, expect, it, vi } from "vitest"

import { resolveTryOnFeatureEnabled, isTryOnGloballyEnabled } from "@/lib/flags/try-on"
import { isApparelProduct } from "@/lib/try-on/is-apparel-product"
import { buildTryOnResultHash } from "@/lib/try-on/result-hash"
import { tryOnCreateBodySchema } from "@/lib/try-on/schemas"

describe("try-on flags", () => {
  it("requires TRY_ON_ENABLED=1", () => {
    vi.stubEnv("TRY_ON_ENABLED", "1")
    expect(isTryOnGloballyEnabled()).toBe(true)
    vi.stubEnv("TRY_ON_ENABLED", "0")
    expect(isTryOnGloballyEnabled()).toBe(false)
    vi.unstubAllEnvs()
  })
})

describe("isApparelProduct", () => {
  it("matches apparel full paths", () => {
    expect(
      isApparelProduct({
        categoryFullPath: "Apparel & Accessories > Clothing > Dresses",
        legacyCategories: [],
      })
    ).toBe(true)
  })

  it("rejects electronics", () => {
    expect(
      isApparelProduct({
        categoryFullPath: "Electronics > Phones",
        legacyCategories: [],
      })
    ).toBe(false)
  })

  it("matches French vêtements and collants", () => {
    expect(
      isApparelProduct({
        categoryFullPath:
          "Vêtements et accessoires > Vêtements > Vêtements fitness et sports > Tenues de cyclisme > Collants de cyclisme",
        legacyCategories: ["Collants de cyclisme", "Vêtements"],
      })
    ).toBe(true)
  })
})

describe("buildTryOnResultHash", () => {
  it("is stable for same inputs", () => {
    const a = buildTryOnResultHash({
      inputUrl: "https://blob.example/a.webp?v=1",
      productId: "p1",
      angle: "front",
    })
    const b = buildTryOnResultHash({
      inputUrl: "https://blob.example/a.webp?v=2",
      productId: "p1",
      angle: "front",
    })
    expect(a).toBe(b)
  })
})

describe("tryOnCreateBodySchema", () => {
  it("requires gdpr consent", () => {
    const fail = tryOnCreateBodySchema.safeParse({
      productId: "p1",
      inputUrl: "https://example.com/in.webp",
      gdprConsent: false,
      consentVersion: "2026-06-18",
    })
    expect(fail.success).toBe(false)
  })
})
