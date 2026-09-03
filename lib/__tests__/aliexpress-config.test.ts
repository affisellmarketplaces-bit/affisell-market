import { describe, expect, it, afterEach, vi } from "vitest"

import { readAliExpressConfig } from "@/lib/aliexpress-config"

describe("readAliExpressConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("defaults to production API when ALIEXPRESS_ENV is unset", () => {
    vi.stubEnv("ALIEXPRESS_ENV", "")
    expect(readAliExpressConfig().sandbox).toBe(false)
  })

  it("uses sandbox only when ALIEXPRESS_ENV=sandbox", () => {
    vi.stubEnv("ALIEXPRESS_ENV", "sandbox")
    expect(readAliExpressConfig().sandbox).toBe(true)
  })

  it("uses production when ALIEXPRESS_ENV=production", () => {
    vi.stubEnv("ALIEXPRESS_ENV", "production")
    expect(readAliExpressConfig().sandbox).toBe(false)
  })
})
