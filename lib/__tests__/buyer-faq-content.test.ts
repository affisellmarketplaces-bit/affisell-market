import { describe, expect, it } from "vitest"

import { FAQ_SECTIONS } from "@/lib/support/faq-content"

describe("buyer faq content", () => {
  it("uses only buyer categories (no supplier/affiliate)", () => {
    const ids = FAQ_SECTIONS.map((s) => s.id)
    expect(ids).toEqual(["orders", "returns", "payment", "account"])
    expect(ids).not.toContain("shipping")
    expect(ids).not.toContain("perks")
    expect(ids).not.toContain("supplier")
    expect(ids).not.toContain("affiliate")
  })

  it("includes seller and L221-28 return exclusion questions", () => {
    const allIds = FAQ_SECTIONS.flatMap((s) => s.items.map((i) => i.id))
    expect(allIds).toContain("seller")
    expect(allIds).toContain("return-refused")
  })

  it("has no B2B remuneration FAQ keys", () => {
    const keys = FAQ_SECTIONS.flatMap((s) => s.items.flatMap((i) => [i.qKey, i.aKey]))
    expect(keys.some((k) => /remun|affiliate|supplier|wholesale/i.test(k))).toBe(false)
  })
})
