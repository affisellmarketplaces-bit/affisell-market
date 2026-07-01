import { describe, expect, it } from "vitest"

import { isPwaInstallEligiblePath } from "@/lib/pwa-install-shared"

describe("pwa install paths", () => {
  it("allows buyer mobile routes", () => {
    expect(isPwaInstallEligiblePath("/discover")).toBe(true)
    expect(isPwaInstallEligiblePath("/marketplace/account")).toBe(true)
    expect(isPwaInstallEligiblePath("/cart")).toBe(true)
  })

  it("blocks dashboard routes", () => {
    expect(isPwaInstallEligiblePath("/dashboard/supplier")).toBe(false)
  })
})
