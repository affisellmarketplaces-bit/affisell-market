import { afterEach, describe, expect, it, vi } from "vitest"

import { isTryOnQueryOverride, resolveTryOnFeatureEnabled } from "@/lib/flags/try-on"

const on = new URLSearchParams({ tryon: "1" })

function env(vars: Record<string, string>) {
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value)
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("?tryon=1 override of the try-on kill switch", () => {
  it("is ignored on the production deployment: the kill switch really kills", () => {
    env({ VERCEL_ENV: "production", NODE_ENV: "production", TRY_ON_ENABLED: "0" })

    expect(isTryOnQueryOverride(on)).toBe(false)
    expect(resolveTryOnFeatureEnabled(on)).toBe(false)
    expect(resolveTryOnFeatureEnabled(new URLSearchParams({ tryon: "true" }))).toBe(false)
  })

  it("is ignored with NODE_ENV=production when not on Vercel", () => {
    env({ VERCEL_ENV: "", NODE_ENV: "production", TRY_ON_ENABLED: "0" })

    expect(resolveTryOnFeatureEnabled(on)).toBe(false)
  })

  it("still works on a preview deployment, which also runs with NODE_ENV=production", () => {
    env({ VERCEL_ENV: "preview", NODE_ENV: "production", TRY_ON_ENABLED: "0" })

    expect(isTryOnQueryOverride(on)).toBe(true)
    expect(resolveTryOnFeatureEnabled(on)).toBe(true)
  })

  it("still works in development", () => {
    env({ VERCEL_ENV: "", NODE_ENV: "development", TRY_ON_ENABLED: "0" })

    expect(resolveTryOnFeatureEnabled(on)).toBe(true)
  })

  it("never turns anything on without the parameter", () => {
    env({ VERCEL_ENV: "preview", TRY_ON_ENABLED: "0" })

    expect(resolveTryOnFeatureEnabled(new URLSearchParams())).toBe(false)
    expect(resolveTryOnFeatureEnabled(null)).toBe(false)
    expect(resolveTryOnFeatureEnabled(undefined)).toBe(false)
  })

  for (const value of ["0", "false", "yes", "", " "]) {
    it(`does not treat tryon=${JSON.stringify(value)} as an override`, () => {
      env({ VERCEL_ENV: "preview", TRY_ON_ENABLED: "0" })

      expect(resolveTryOnFeatureEnabled(new URLSearchParams({ tryon: value }))).toBe(false)
    })
  }

  it("leaves the real switch alone: TRY_ON_ENABLED=1 enables the feature in production", () => {
    env({ VERCEL_ENV: "production", NODE_ENV: "production", TRY_ON_ENABLED: "1" })

    expect(resolveTryOnFeatureEnabled(new URLSearchParams())).toBe(true)
  })
})
