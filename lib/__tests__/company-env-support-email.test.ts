import { afterEach, describe, expect, it, vi } from "vitest"

import { resolveSupportEmail } from "@/lib/legal/company-env"

describe("resolveSupportEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("falls back when SUPPORT_EMAIL is truncated", () => {
    vi.stubEnv("SUPPORT_EMAIL", "support@")
    expect(resolveSupportEmail()).toBe("support@affisell.com")
  })

  it("uses valid SUPPORT_EMAIL from env", () => {
    vi.stubEnv("SUPPORT_EMAIL", "hello@affisell.com")
    expect(resolveSupportEmail()).toBe("hello@affisell.com")
  })

  it("defaults when env is unset", () => {
    vi.stubEnv("SUPPORT_EMAIL", "")
    expect(resolveSupportEmail()).toBe("support@affisell.com")
  })
})
