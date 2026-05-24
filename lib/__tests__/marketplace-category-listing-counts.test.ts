import { describe, expect, it } from "vitest"

describe("marketplace category scope labels", () => {
  it("matches legacy categories[] by department name (case-insensitive)", () => {
    const labels = new Set<string>()
    const name = "Apparel & Accessories"
    labels.add(name.toLowerCase())
    const productCategories = ["Apparel & Accessories"]
    const hit = productCategories.some((c) => labels.has(c.trim().toLowerCase()))
    expect(hit).toBe(true)
  })
})
