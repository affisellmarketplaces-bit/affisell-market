import { afterEach, describe, expect, it } from "vitest"

import { isDemoLabEmail } from "@/lib/demo/demo-accounts-shared"
import {
  getDemoLabPublicState,
  isDemoLabEnabled,
  resolveDemoPassword,
} from "@/lib/demo/demo-accounts-config"

const ENV_KEYS = [
  "DEMO_LAB_ENABLED",
  "DEMO_LAB_PASSWORD",
  "DEMO_SUPPLIER_PASSWORD",
  "DEMO_AFFILIATE_PASSWORD",
  "DEMO_BUYER_PASSWORD",
] as const

function snapshotEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {}
  for (const k of ENV_KEYS) {
    snap[k] = process.env[k]
  }
  return snap
}

function restoreEnv(snap: Record<string, string | undefined>) {
  for (const k of ENV_KEYS) {
    const v = snap[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}

describe("demo accounts config", () => {
  const before = snapshotEnv()

  afterEach(() => {
    restoreEnv(before)
  })

  it("isDemoLabEnabled respects DEMO_LAB_ENABLED", () => {
    delete process.env.DEMO_LAB_ENABLED
    expect(isDemoLabEnabled()).toBe(false)
    process.env.DEMO_LAB_ENABLED = "1"
    expect(isDemoLabEnabled()).toBe(true)
  })

  it("resolveDemoPassword prefers DEMO_LAB_PASSWORD", () => {
    process.env.DEMO_LAB_PASSWORD = "shared-secret"
    process.env.DEMO_SUPPLIER_PASSWORD = "other"
    expect(resolveDemoPassword("supplier")).toBe("shared-secret")
  })

  it("getDemoLabPublicState requires password when enabled", () => {
    process.env.DEMO_LAB_ENABLED = "1"
    delete process.env.DEMO_LAB_PASSWORD
    delete process.env.DEMO_SUPPLIER_PASSWORD
    expect(getDemoLabPublicState()).toEqual({ enabled: true, configured: false })
    process.env.DEMO_LAB_PASSWORD = "x"
    expect(getDemoLabPublicState()).toEqual({ enabled: true, configured: true })
  })

  it("isDemoLabEmail detects sandbox emails", () => {
    expect(isDemoLabEmail("demo-supplier@demo.affisell.com")).toBe(true)
    expect(isDemoLabEmail("real@affisell.com")).toBe(false)
  })
})
