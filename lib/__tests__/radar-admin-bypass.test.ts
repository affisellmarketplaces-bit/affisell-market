import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/radar/env", () => ({
  RADAR_ENABLED: "true",
  RADAR_BETA_USER_IDS: [] as string[],
  resolveRadarDatabaseUrl: () => undefined,
}))

describe("Radar ADMIN bypass", () => {
  beforeEach(() => {
    vi.stubEnv("RADAR_PLANS_ENABLED", "true")
  })

  it("grants Global plan to ADMIN without Stripe", async () => {
    const { getUserRadarPlan } = await import("@/lib/radar/plans")
    const plan = getUserRadarPlan({
      id: "admin-1",
      email: "admin@affisell.com",
      role: "ADMIN",
    })
    expect(plan.id).toBe("global")
    expect(plan.hasMap).toBe(true)
    expect(plan.hasSlack).toBe(true)
  })

  it("allows map access for ADMIN", async () => {
    const { checkRadarAccess } = await import("@/lib/radar/gate-with-plan")
    const access = checkRadarAccess({ id: "admin-1", role: "ADMIN" }, "map")
    expect(access.allowed).toBe(true)
  })

  it("resolves radar_global features for ADMIN", async () => {
    const { hasRadarAccess, resolveRadarFeatures } = await import("@/lib/radar/features")
    const features = resolveRadarFeatures("admin-1", false, "free", "ADMIN")
    expect(features).toContain("radar_global")
    expect(hasRadarAccess([], "admin-1", "ADMIN")).toBe(true)
  })

  it("keeps free customers blocked on map", async () => {
    const { checkRadarAccess } = await import("@/lib/radar/gate-with-plan")
    const access = checkRadarAccess({ id: "user-1", role: "CUSTOMER" }, "map")
    expect(access.allowed).toBe(false)
  })
})
