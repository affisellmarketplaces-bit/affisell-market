import { describe, expect, it, vi } from "vitest"

import { resolveTryOnFeatureEnabled, isTryOnGloballyEnabled } from "@/lib/flags/try-on"
import { isApparelProduct } from "@/lib/try-on/is-apparel-product"
import { buildTryOnResultHash } from "@/lib/try-on/result-hash"
import { tryOnCreateBodySchema } from "@/lib/try-on/schemas"

describe("try-on flags", () => {
  it("is off in production by default unless query override", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("TRY_ON_ENABLED", "")
    expect(isTryOnGloballyEnabled()).toBe(false)
    expect(
      resolveTryOnFeatureEnabled(new URLSearchParams("tryon=true"))
    ).toBe(true)
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
