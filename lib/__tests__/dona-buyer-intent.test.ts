import { describe, expect, it } from "vitest"

import { isDonaBestsellerIntent } from "@/lib/dona/dona-buyer-intent"

describe("dona buyer intent", () => {
  it("detects bestseller questions FR/EN", () => {
    expect(isDonaBestsellerIntent("c'est quoi le produit le plus vendu ?")).toBe(true)
    expect(isDonaBestsellerIntent("best seller this week")).toBe(true)
    expect(isDonaBestsellerIntent("top ventes")).toBe(true)
    expect(isDonaBestsellerIntent("classement bestsellers")).toBe(true)
  })

  it("does not flag generic product search", () => {
    expect(isDonaBestsellerIntent("montre connectée")).toBe(false)
    expect(isDonaBestsellerIntent("lien")).toBe(false)
    expect(isDonaBestsellerIntent("")).toBe(false)
  })
})
