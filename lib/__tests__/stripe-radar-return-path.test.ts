import { describe, expect, it } from "vitest"

import { sanitizeRadarReturnPath } from "@/lib/stripe-radar"

describe("sanitizeRadarReturnPath", () => {
  it("allows pricing and radar paths", () => {
    expect(sanitizeRadarReturnPath("/pricing")).toBe("/pricing")
    expect(sanitizeRadarReturnPath("/radar/map")).toBe("/radar/map")
  })

  it("allows admin radar QA return path", () => {
    expect(sanitizeRadarReturnPath("/admin/radar")).toBe("/admin/radar")
  })

  it("rejects open redirects", () => {
    expect(sanitizeRadarReturnPath("https://evil.com")).toBe("/radar")
    expect(sanitizeRadarReturnPath("//evil.com")).toBe("/radar")
    expect(sanitizeRadarReturnPath("/dashboard")).toBe("/radar")
  })
})
