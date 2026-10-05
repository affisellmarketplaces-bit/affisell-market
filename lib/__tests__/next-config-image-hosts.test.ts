import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  canOptimizeImageSrc,
  hostnameMatchesPattern,
  isConfiguredRemoteImageHost,
  REMOTE_IMAGE_PATTERNS,
} from "@/lib/image-remote-hosts"

describe("remote image hosts", () => {
  // Product images are stored with the source marketplace's CDN URL. A host missing here must not take a page down
  // (SafeImage loads it directly), but the hosts the import flows rely on should still be optimized.
  it.each([
    "ae01.alicdn.com",
    "ae03.alicdn.com",
    "img.alicdn.com",
    "cbu01.alicdn.com",
    "ae-pic-a1.aliexpress-media.com",
    "img.kwcdn.com",
    "img.ltwebstatic.com",
    "m.media-amazon.com",
  ])("optimizes %s", (host) => {
    expect(isConfiguredRemoteImageHost(host)).toBe(true)
  })

  it("is not an open image proxy: every pattern is https, scoped to a domain, with the catch-all path", () => {
    for (const p of REMOTE_IMAGE_PATTERNS) {
      expect(p.protocol).toBe("https")
      expect(p.pathname).toBe("/**")
      expect(p.hostname).not.toMatch(/^\*+$/)
      expect(p.hostname.replace(/^\*+\./, "")).toContain(".")
    }
    expect(isConfiguredRemoteImageHost("example.com")).toBe(false)
    expect(isConfiguredRemoteImageHost("evil-alicdn.com")).toBe(false)
    expect(isConfiguredRemoteImageHost("alicdn.com.evil.test")).toBe(false)
  })

  it("matches wildcards like Next does", () => {
    expect(hostnameMatchesPattern("**.alicdn.com", "a.b.alicdn.com")).toBe(true)
    expect(hostnameMatchesPattern("**.alicdn.com", "alicdn.com")).toBe(false)
    expect(hostnameMatchesPattern("*.alicdn.com", "a.alicdn.com")).toBe(true)
    expect(hostnameMatchesPattern("*.alicdn.com", "a.b.alicdn.com")).toBe(false)
    expect(hostnameMatchesPattern("cdn.shopify.com", "cdn.shopify.com")).toBe(true)
  })

  it("canOptimizeImageSrc: local and data URLs yes; unknown hosts, http and junk no", () => {
    expect(canOptimizeImageSrc("/uploads/a.jpg")).toBe(true)
    expect(canOptimizeImageSrc("data:image/png;base64,AAAA")).toBe(true)
    expect(canOptimizeImageSrc("https://ae01.alicdn.com/kf/a.jpg")).toBe(true)
    expect(canOptimizeImageSrc("https://some-new-cdn.example/a.jpg")).toBe(false)
    expect(canOptimizeImageSrc("http://ae01.alicdn.com/kf/a.jpg")).toBe(false)
    expect(canOptimizeImageSrc("//ae01.alicdn.com/kf/a.jpg")).toBe(false)
    expect(canOptimizeImageSrc("not a url")).toBe(false)
  })

  it("next.config.ts uses the shared list instead of its own copy", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../../next.config.ts"), "utf8")
    expect(src).toContain("REMOTE_IMAGE_PATTERNS")
    expect(src).not.toMatch(/hostname:\s*"/)
  })
})
