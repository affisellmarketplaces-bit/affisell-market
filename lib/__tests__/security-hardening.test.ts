import { afterEach, describe, expect, it, vi } from "vitest"

import {
  assertSafeOutboundUrl,
  isBlockedOutboundHostname,
} from "@/lib/safe-outbound-url"
import { sniffUploadBytes } from "@/lib/upload-content-sniff"
import { AFFISELL_CSP_REPORT_ONLY, buildSecurityHeaders } from "@/lib/security-headers"
import {
  assertSameSiteRequestOrigin,
  isAllowedRequestOrigin,
} from "@/lib/request-origin-guard"
import { verifyAutoDsWebhookSignature } from "@/lib/autods/verify-webhook-signature"

describe("safe-outbound-url", () => {
  it("allows public https hosts", () => {
    const r = assertSafeOutboundUrl("https://cdn.example.com/a.jpg")
    expect(r.ok).toBe(true)
  })

  it("blocks private and metadata hosts", () => {
    expect(isBlockedOutboundHostname("127.0.0.1")).toBe(true)
    expect(isBlockedOutboundHostname("10.0.0.5")).toBe(true)
    expect(isBlockedOutboundHostname("192.168.1.1")).toBe(true)
    expect(isBlockedOutboundHostname("169.254.169.254")).toBe(true)
    expect(isBlockedOutboundHostname("localhost")).toBe(true)
    expect(assertSafeOutboundUrl("https://169.254.169.254/latest").ok).toBe(false)
    expect(assertSafeOutboundUrl("http://example.com/x").ok).toBe(false)
    expect(assertSafeOutboundUrl("http://example.com/x", { allowHttp: true }).ok).toBe(true)
  })
})

describe("upload-content-sniff", () => {
  it("detects jpeg / png / pdf and rejects html/svg", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
    expect(sniffUploadBytes(jpeg)?.kind).toBe("jpeg")

    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ])
    expect(sniffUploadBytes(png)?.kind).toBe("png")

    const pdf = Buffer.from("%PDF-1.4......")
    expect(sniffUploadBytes(pdf)?.kind).toBe("pdf")

    const html = Buffer.from("<!DOCTYPE html><html><body>x</body></html>")
    expect(sniffUploadBytes(html)).toBeNull()

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    expect(sniffUploadBytes(svg)).toBeNull()
  })
})

describe("security-headers", () => {
  it("includes clickjacking, CORP, and Report-Only CSP", () => {
    const headers = buildSecurityHeaders()
    const keys = headers.map((h) => h.key)
    expect(keys).toContain("X-Frame-Options")
    expect(keys).toContain("Cross-Origin-Opener-Policy")
    expect(keys).toContain("Content-Security-Policy")
    expect(keys).toContain("Content-Security-Policy-Report-Only")
    const csp = headers.find((h) => h.key === "Content-Security-Policy")?.value ?? ""
    expect(csp).toContain("frame-ancestors 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(AFFISELL_CSP_REPORT_ONLY).toContain("https://js.stripe.com")
    expect(AFFISELL_CSP_REPORT_ONLY).toContain("report-uri /api/csp-report")
  })
})

describe("request-origin-guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("allows same-origin Sec-Fetch-Site and platform Origin", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("VERCEL", "")
    vi.stubEnv("AFFISELL_PLATFORM_ORIGIN", "https://affisell.com")

    const sameOrigin = assertSameSiteRequestOrigin(
      new Request("https://affisell.com/api/x", {
        method: "POST",
        headers: { "sec-fetch-site": "same-origin" },
      })
    )
    expect(sameOrigin).toBeNull()

    expect(isAllowedRequestOrigin("https://affisell.com")).toBe(true)

    const ok = assertSameSiteRequestOrigin(
      new Request("https://affisell.com/api/x", {
        method: "POST",
        headers: { origin: "https://affisell.com" },
      })
    )
    expect(ok).toBeNull()

    const bad = assertSameSiteRequestOrigin(
      new Request("https://affisell.com/api/x", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      })
    )
    expect(bad?.status).toBe(403)
  })

  it("skips Bearer machine callers", () => {
    const res = assertSameSiteRequestOrigin(
      new Request("https://affisell.com/api/x", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          authorization: "Bearer cron-secret",
        },
      })
    )
    expect(res).toBeNull()
  })
})

describe("autods webhook signature gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("fails closed in production without secret", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VERCEL", "")
    vi.stubEnv("AUTODS_WEBHOOK_SECRET", "")
    expect(verifyAutoDsWebhookSignature("{}", null, "1.1.1.1")).toBe("missing_prod")
  })

  it("skips signature in local dev without secret", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("VERCEL", "")
    vi.stubEnv("AUTODS_WEBHOOK_SECRET", "")
    expect(verifyAutoDsWebhookSignature("{}", null, "1.1.1.1")).toBe("skipped")
  })
})
