import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

/** Hostname patterns from next.config.ts `images.remotePatterns`, read as text (the config pulls in Sentry). */
function configuredHostPatterns(): string[] {
  const src = fs.readFileSync(path.resolve(__dirname, "../../next.config.ts"), "utf8")
  const block = src.slice(src.indexOf("remotePatterns"))
  return [...block.matchAll(/hostname:\s*"([^"]+)"/g)].map((m) => m[1]!)
}

/** Next's matcher: `**.` = any number of subdomain labels (not the bare apex), `*.` = exactly one, else exact. */
function hostAllowed(patterns: string[], host: string): boolean {
  return patterns.some((p) => {
    if (p.startsWith("**.")) return host.endsWith(p.slice(2)) && host.length > p.length - 2
    if (p.startsWith("*.")) return host.endsWith(p.slice(1)) && !host.slice(0, -(p.length - 1)).includes(".")
    return host === p
  })
}

describe("next/image remote hosts", () => {
  const patterns = configuredHostPatterns()

  // Product images are stored with the source marketplace's CDN URL. A host missing from remotePatterns makes next/image
  // throw during render — the whole dashboard section shows "This section failed to load" for one product.
  it.each([
    "ae01.alicdn.com",
    "ae03.alicdn.com",
    "img.alicdn.com",
    "cbu01.alicdn.com",
    "ae-pic-a1.aliexpress-media.com",
    "img.kwcdn.com",
    "img.ltwebstatic.com",
    "m.media-amazon.com",
  ])("allows %s", (host) => {
    expect(hostAllowed(patterns, host)).toBe(true)
  })

  it("is not an open image proxy", () => {
    expect(hostAllowed(patterns, "example.com")).toBe(false)
    expect(hostAllowed(patterns, "evil-alicdn.com")).toBe(false)
    expect(patterns.every((p) => p !== "**" && p !== "*")).toBe(true)
  })
})
