import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/radar/env", () => ({
  RADAR_ENABLED: "true",
  RADAR_BETA_USER_IDS: [] as string[],
  resolveRadarDatabaseUrl: () => undefined,
}))

describe("Growth plan → Radar plan floor", () => {
  beforeEach(() => {
    vi.stubEnv("RADAR_PLANS_ENABLED", "true")
  })

  it("floors Dominator at Radar Pro and Empire at Radar Global", async () => {
    const { getUserRadarPlan } = await import("@/lib/radar/plans")
    expect(
      getUserRadarPlan({ id: "u1", role: "SUPPLIER", growthPlan: "dominator" }).id
    ).toBe("pro")
    expect(
      getUserRadarPlan({ id: "u2", role: "SUPPLIER", growthPlan: "empire" }).id
    ).toBe("global")
  })

  it("does not grant anything for Lanceur or no plan", async () => {
    const { getUserRadarPlan } = await import("@/lib/radar/plans")
    expect(getUserRadarPlan({ id: "u3", role: "AFFILIATE", growthPlan: "lanceur" }).id).toBe(
      "free"
    )
    expect(getUserRadarPlan({ id: "u4", role: "SUPPLIER", growthPlan: "none" }).id).toBe("free")
    expect(getUserRadarPlan({ id: "u5", role: "SUPPLIER" }).id).toBe("free")
  })

  it("is a floor, not an override — a directly-purchased higher Radar tier is kept", async () => {
    const { getUserRadarPlan } = await import("@/lib/radar/plans")
    // Dominator floors at pro, but this user separately bought Radar Global — must stay Global.
    const plan = getUserRadarPlan({
      id: "u6",
      role: "SUPPLIER",
      growthPlan: "dominator",
      subscriptionTiers: ["global"],
    })
    expect(plan.id).toBe("global")
  })

  it("Empire floor does not downgrade an explicit Radar Global purchase either", async () => {
    const { getUserRadarPlan } = await import("@/lib/radar/plans")
    const plan = getUserRadarPlan({
      id: "u7",
      role: "SUPPLIER",
      growthPlan: "empire",
      subscriptionTiers: ["global"],
    })
    expect(plan.id).toBe("global")
  })

  it("ADMIN/beta bypasses still short-circuit above the growth floor", async () => {
    const { getUserRadarPlan } = await import("@/lib/radar/plans")
    // Even a Lanceur (no floor) ADMIN gets Global via the existing bypass, unaffected by growthPlan.
    const plan = getUserRadarPlan({ id: "u8", role: "ADMIN", growthPlan: "lanceur" })
    expect(plan.id).toBe("global")
  })

  it("resolveRadarFeatures also floors at pro/global for Dominator/Empire", async () => {
    const { resolveRadarFeatures } = await import("@/lib/radar/features")
    expect(resolveRadarFeatures("u9", false, "free", "SUPPLIER", "dominator")).toContain(
      "radar_pro"
    )
    expect(resolveRadarFeatures("u10", false, "free", "SUPPLIER", "empire")).toContain(
      "radar_global"
    )
    expect(resolveRadarFeatures("u11", false, "free", "AFFILIATE", "lanceur")).toEqual([])
  })

  it("resolveRadarFeatures keeps a directly-purchased radarPlan when it's stronger than the floor", async () => {
    const { resolveRadarFeatures } = await import("@/lib/radar/features")
    const features = resolveRadarFeatures("u12", false, "global", "SUPPLIER", "dominator")
    expect(features).toContain("radar_global")
    expect(features).not.toContain("radar_pro")
  })
})
