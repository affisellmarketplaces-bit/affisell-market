import { describe, expect, it } from "vitest"

import { trimColorSwatchImageForStore } from "@/lib/color-swatch-store"

describe("trimColorSwatchImageForStore", () => {
  it("keeps longer data URLs", () => {
    const data = `data:image/jpeg;base64,${"a".repeat(3000)}`
    expect(trimColorSwatchImageForStore(data)).toBe(data)
  })

  it("caps https URLs at 8192", () => {
    const url = `https://cdn.example/${"x".repeat(9000)}.jpg`
    expect(trimColorSwatchImageForStore(url).length).toBe(8192)
  })

  it("does not cap https URLs under 8192 chars", () => {
    const url = `https://cdn.example/${"x".repeat(2500)}.jpg`
    expect(trimColorSwatchImageForStore(url)).toBe(url)
  })
})
