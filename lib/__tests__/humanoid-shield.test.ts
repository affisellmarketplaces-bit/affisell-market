import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"

import {
  createHumanPassToken,
  sanitizeShieldReturnTo,
  verifyHumanPassToken,
} from "@/lib/security/human-pass"
import { HumanoidShield } from "@/lib/security/humanoid-shield"

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "vitest-human-pass-secret"

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

  it("allows curl without UA on product-social-proof API path", () => {
    const result = HumanoidShield.analyze(mockReq("/api/product-social-proof?productId=abc"))
    expect(result.threats.some((t) => t.type === "BOT_UA")).toBe(false)
    expect(result.action).not.toBe("BLOCK")
  })

  it("allows curl without UA from localhost in non-prod", () => {
    const result = HumanoidShield.analyze(
      mockReq("/dashboard/affiliate", {
        headers: { "x-forwarded-for": "127.0.0.1" },
      })
    )
    expect(result.threats.some((t) => t.type === "BOT_UA")).toBe(false)
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

  it("prefers cf-connecting-ip over x-forwarded-for", () => {
    const req = mockReq("/", {
      headers: {
        "cf-connecting-ip": "203.0.113.44",
        "x-forwarded-for": "172.71.127.104, 203.0.113.44",
      },
    })
    expect(HumanoidShield.extractIp(req)).toBe("203.0.113.44")
  })

  it("does not treat supplier APIs as admin-sensitive", () => {
    expect(HumanoidShield.isAdminSensitivePath("/api/supplier/orders")).toBe(false)
    expect(HumanoidShield.isMerchantWorkspacePath("/api/supplier/orders")).toBe(true)
    expect(HumanoidShield.isAdminSensitivePath("/dashboard/admin/users")).toBe(true)
  })

  it("does not volume-BLOCK a signed-in supplier after a dashboard burst", () => {
    const ip = "80.215.159.234"
    HumanoidShield.unbanIp(ip)
    const headers = {
      "user-agent": "Mozilla/5.0 Chrome/124",
      "cf-connecting-ip": ip,
    }
    for (let i = 0; i < 40; i += 1) {
      HumanoidShield.analyze(
        mockReq("/api/supplier/orders", { headers }),
        { sessionTrusted: true }
      )
    }
    const result = HumanoidShield.analyze(
      mockReq("/dashboard/supplier", { headers }),
      { sessionTrusted: true }
    )
    expect(result.action).toBe("ALLOW")
    HumanoidShield.unbanIp(ip)
  })

  it("still blocks honeypots even with a trusted session", () => {
    const result = HumanoidShield.analyze(mockReq("/.env"), { sessionTrusted: true })
    expect(result.action).toBe("BLOCK")
  })

  it("does not flag CSS-like double dashes as SQLi", () => {
    const result = HumanoidShield.analyze(mockReq("/marketplace?tw=foo--bar"))
    expect(result.threats.some((t) => t.type === "SQLI")).toBe(false)
  })

  it("allows rate-limited traffic when a valid human pass cookie is present", () => {
    const ip = "203.0.113.55"
    HumanoidShield.banIp(ip, 5)
    const token = createHumanPassToken(ip)
    const req = mockReq("/?category=cmp123", {
      headers: {
        "user-agent": "Mozilla/5.0 Chrome/120",
        "cf-connecting-ip": ip,
        cookie: `affisell_human_pass=${token}`,
      },
    })
    const result = HumanoidShield.analyze(req)
    expect(result.action).toBe("ALLOW")
    HumanoidShield.unbanIp(ip)
  })
})

describe("human-pass", () => {
  it("sanitizes open redirects", () => {
    expect(sanitizeShieldReturnTo("/?category=cmp1")).toBe("/?category=cmp1")
    expect(sanitizeShieldReturnTo("//evil.com")).toBe("/")
    expect(sanitizeShieldReturnTo("https://evil.com")).toBe("/")
  })

  it("verifies signed human pass tokens", () => {
    const ip = "198.51.100.2"
    const token = createHumanPassToken(ip)
    expect(verifyHumanPassToken(token, ip)).toBe(true)
    expect(verifyHumanPassToken(token, "198.51.100.3")).toBe(false)
  })
})
