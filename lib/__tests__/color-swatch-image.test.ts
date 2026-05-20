import { describe, expect, it } from "vitest"

import { trimColorSwatchImageForStore } from "@/lib/color-swatch-store"

describe("trimColorSwatchImageForStore", () => {
  it("keeps longer data URLs", () => {
    const data = `data:image/jpeg;base64,${"a".repeat(3000)}`
    expect(trimColorSwatchImageForStore(data)).toBe(data)
  })

  it("caps https URLs at 2000", () => {
    const url = `https://cdn.example/${"x".repeat(3000)}.jpg`
    expect(trimColorSwatchImageForStore(url).length).toBe(2000)
  })
})
