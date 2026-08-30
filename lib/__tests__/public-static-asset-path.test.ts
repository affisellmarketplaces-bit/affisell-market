import { describe, expect, it } from "vitest"

import { isPublicStaticAssetPath } from "@/lib/public-static-asset-path"

describe("isPublicStaticAssetPath", () => {
  it("detects public root assets", () => {
    expect(isPublicStaticAssetPath("/dona-avatar-circle.webp")).toBe(true)
    expect(isPublicStaticAssetPath("/favicon-32.png")).toBe(true)
    expect(isPublicStaticAssetPath("/icons/pwa-192.png")).toBe(true)
  })

  it("ignores app routes", () => {
    expect(isPublicStaticAssetPath("/login/supplier")).toBe(false)
    expect(isPublicStaticAssetPath("/marketplace/bestsellers")).toBe(false)
  })
})
