import { describe, expect, it } from "vitest"

import {
  isStorefrontImmersiveLayout,
  STOREFRONT_IMMERSIVE_ROOT_CLASS,
} from "@/lib/storefront-immersive-shared"

describe("storefront-immersive-shared", () => {
  it("detects immersive layout mode", () => {
    expect(isStorefrontImmersiveLayout("immersive")).toBe(true)
    expect(isStorefrontImmersiveLayout("classic")).toBe(false)
    expect(isStorefrontImmersiveLayout(undefined)).toBe(false)
  })

  it("exports stable root class token", () => {
    expect(STOREFRONT_IMMERSIVE_ROOT_CLASS).toBe("affisell-storefront-immersive")
  })
})
