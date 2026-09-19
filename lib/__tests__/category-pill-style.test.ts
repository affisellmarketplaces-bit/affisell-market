import { describe, expect, it } from "vitest"

import { categoryPillClass, categoryPillIconClass } from "@/lib/category-pill-style"

describe("category pill tokens (reference design)", () => {
  it("active = solid #6728E8 with white label/icon", () => {
    expect(categoryPillClass(true)).toContain("bg-[#6728E8]")
    expect(categoryPillClass(true)).toContain("text-white")
    expect(categoryPillIconClass(true)).toBe("text-white")
  })
  it("inactive = translucent lavender, near-black label, deep-violet icon", () => {
    expect(categoryPillClass(false)).toContain("bg-[#8B6ED6]/[0.22]")
    expect(categoryPillClass(false)).toContain("text-[#03020F]")
    expect(categoryPillIconClass(false)).toContain("text-[#472488]")
  })
})
