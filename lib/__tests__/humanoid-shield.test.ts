import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"

import { HumanoidShield } from "@/lib/security/humanoid-shield"

function mockReq(path: string, init?: RequestInit): NextRequest {
  return new NextRequest(`http://localhost:3001${path}`, init)
}

describe("HumanoidShield", () => {
  it("blocks honeypot paths such as /.env", () => {
    const result = HumanoidShield.analyze(mockReq("/.env"))
    expect(result.action).toBe("BLOCK")
    expect(result.threats.some((t) => t.type === "HONEYPOT")).toBe(true)
  })

  it("blocks /api/admin/bypass with JSON-worthy action", () => {
    const result = HumanoidShield.analyze(mockReq("/api/admin/bypass"))
    expect(result.action).toBe("BLOCK")
    expect(result.threats.some((t) => t.type === "HONEYPOT")).toBe(true)
  })

  it("allows normal marketplace paths for localhost", () => {
    const result = HumanoidShield.analyze(
      mockReq("/dashboard/reseller/requests/new", {
        headers: { "user-agent": "Mozilla/5.0 Affisell Test" },
      })
    )
    expect(result.action).not.toBe("BLOCK")
  })

  it("detects SQLi patterns in query strings", () => {
    const result = HumanoidShield.analyze(mockReq("/shops?q=1'%20OR%201=1--"))
    expect(result.threats.some((t) => t.type === "SQLI")).toBe(true)
  })
})
