import { describe, expect, it } from "vitest"

import { isIngDashboardEnabled } from "@/lib/ing/ing-ops-config"

describe("isIngDashboardEnabled", () => {
  it("is enabled by default in production", () => {
    expect(
      isIngDashboardEnabled({
        NODE_ENV: "production",
      } as NodeJS.ProcessEnv)
    ).toBe(true)
  })

  it("can be disabled explicitly", () => {
    expect(
      isIngDashboardEnabled({
        ING_DASHBOARD_ENABLED: "false",
        NODE_ENV: "production",
      } as NodeJS.ProcessEnv)
    ).toBe(false)
    expect(
      isIngDashboardEnabled({
        ING_DASHBOARD_ENABLED: "0",
      } as NodeJS.ProcessEnv)
    ).toBe(false)
  })

  it("accepts explicit true", () => {
    expect(
      isIngDashboardEnabled({
        ING_DASHBOARD_ENABLED: "true",
      } as NodeJS.ProcessEnv)
    ).toBe(true)
  })
})
