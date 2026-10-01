import { describe, expect, it, vi, beforeEach } from "vitest"

const { findUniqueUser, countProduct } = vi.hoisted(() => ({
  findUniqueUser: vi.fn(),
  countProduct: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: findUniqueUser },
    product: { count: countProduct },
  },
}))

import { assertProductCreationAllowed, DEFAULT_CATALOG_CAP } from "@/lib/growth/catalog-cap.server"

describe("Growth catalog cap", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    findUniqueUser.mockReset()
    countProduct.mockReset()
  })

  it("allows Dominator/Empire suppliers unconditionally (no count query)", async () => {
    findUniqueUser.mockResolvedValue({ growthPlan: "dominator", catalogCapBaselineCount: null })
    const result = await assertProductCreationAllowed("supplier-1")
    expect(result).toEqual({ allowed: true })
    expect(countProduct).not.toHaveBeenCalled()
  })

  it("blocks a free-tier supplier once they reach the default cap (no baseline)", async () => {
    findUniqueUser.mockResolvedValue({ growthPlan: "none", catalogCapBaselineCount: null })
    countProduct.mockResolvedValue(DEFAULT_CATALOG_CAP)
    const result = await assertProductCreationAllowed("supplier-2")
    expect(result).toEqual({ allowed: false, cap: DEFAULT_CATALOG_CAP, current: DEFAULT_CATALOG_CAP })
  })

  it("allows a supplier under the default cap", async () => {
    findUniqueUser.mockResolvedValue({ growthPlan: "none", catalogCapBaselineCount: null })
    countProduct.mockResolvedValue(DEFAULT_CATALOG_CAP - 1)
    const result = await assertProductCreationAllowed("supplier-3")
    expect(result).toEqual({ allowed: true })
  })

  it("grandfathers a supplier whose baseline was already above the default cap", async () => {
    // Regression: a supplier with 500 live products when the cap launched must not be blocked
    // at 200 — their effective cap is frozen at their own baseline (500), not retroactively cut.
    findUniqueUser.mockResolvedValue({ growthPlan: "none", catalogCapBaselineCount: 500 })
    countProduct.mockResolvedValue(500)
    const atBaseline = await assertProductCreationAllowed("supplier-4")
    expect(atBaseline).toEqual({ allowed: false, cap: 500, current: 500 })

    countProduct.mockResolvedValue(499)
    const underBaseline = await assertProductCreationAllowed("supplier-4")
    expect(underBaseline).toEqual({ allowed: true })
  })

  it("a baseline below the default still uses the default (never lowers the cap)", async () => {
    findUniqueUser.mockResolvedValue({ growthPlan: "none", catalogCapBaselineCount: 50 })
    countProduct.mockResolvedValue(150)
    const result = await assertProductCreationAllowed("supplier-5")
    expect(result).toEqual({ allowed: true })
  })

  it("is bypassed entirely when GROWTH_CATALOG_CAP_PAUSED is set", async () => {
    vi.stubEnv("GROWTH_CATALOG_CAP_PAUSED", "1")
    const result = await assertProductCreationAllowed("supplier-6")
    expect(result).toEqual({ allowed: true })
    expect(findUniqueUser).not.toHaveBeenCalled()
  })
})
