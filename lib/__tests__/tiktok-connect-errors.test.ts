import { describe, expect, it } from "vitest"

import { resolveTikTokConnectError } from "@/lib/radar/tiktok-connect-errors"

describe("resolveTikTokConnectError", () => {
  it("explains draft-app no-shop failures", () => {
    const copy = resolveTikTokConnectError("no_shop_available")
    expect(copy?.title).toMatch(/draft/i)
    expect(copy?.steps.some((s) => /Partner Center/i.test(s))).toBe(true)
  })

  it("returns null when no error", () => {
    expect(resolveTikTokConnectError(null)).toBeNull()
  })
})
