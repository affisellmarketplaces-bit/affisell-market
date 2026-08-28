import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"

import { HumanoidShield } from "@/lib/security/humanoid-shield"

function mockReq(
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1]
): NextRequest {
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

  it("banIp and unbanIp manage active bans", () => {
    const ban = HumanoidShield.banIp("203.0.113.9", 5)
    expect(ban.blockedUntil).toBeGreaterThan(Date.now())
    expect(HumanoidShield.getActiveBans().some((b) => b.ip === "203.0.113.9")).toBe(true)
    HumanoidShield.unbanIp("203.0.113.9")
    expect(HumanoidShield.getActiveBans().some((b) => b.ip === "203.0.113.9")).toBe(false)
  })
})
