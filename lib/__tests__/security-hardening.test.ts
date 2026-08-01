import { describe, expect, it } from "vitest"

import {
  assertSafeOutboundUrl,
  isBlockedOutboundHostname,
} from "@/lib/safe-outbound-url"
import { sniffUploadBytes } from "@/lib/upload-content-sniff"
import { buildSecurityHeaders } from "@/lib/security-headers"

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
  it("includes clickjacking and CORP hardening", () => {
    const keys = buildSecurityHeaders().map((h) => h.key)
    expect(keys).toContain("X-Frame-Options")
    expect(keys).toContain("Cross-Origin-Opener-Policy")
    expect(keys).toContain("Content-Security-Policy")
    const csp = buildSecurityHeaders().find((h) => h.key === "Content-Security-Policy")?.value ?? ""
    expect(csp).toContain("frame-ancestors 'self'")
    expect(csp).toContain("object-src 'none'")
  })
})
