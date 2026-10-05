import { describe, expect, it } from "vitest"

import { listingAtAGlance } from "@/app/marketplace/[id]/listing-detail-utils"
import { AFFISELL_CSP_REPORT_ONLY } from "@/lib/security-headers"
import { sliceSafe, truncateText } from "@/lib/truncate-text"

/** A high surrogate not followed by a low one, or a low one not preceded by a high one. */
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/

describe("sliceSafe / truncateText", () => {
  it("is a plain slice when the cut is clean", () => {
    expect(sliceSafe("hello world", 5)).toBe("hello")
    expect(sliceSafe("short", 50)).toBe("short")
    expect(sliceSafe("anything", 0)).toBe("")
  })

  it("never leaves half an emoji", () => {
    const text = `ab🔥cd` // 🔥 is two UTF-16 units at index 2-3
    expect(text.slice(0, 3)).toMatch(LONE_SURROGATE) // what a plain slice does
    expect(sliceSafe(text, 3)).toBe("ab")
    expect(sliceSafe(text, 4)).toBe("ab🔥")
    expect(sliceSafe(text, 3)).not.toMatch(LONE_SURROGATE)
  })

  it("truncateText appends the ellipsis only when something was cut", () => {
    expect(truncateText("abc", 5)).toBe("abc")
    expect(truncateText("abcdef", 3)).toBe("abc…")
    expect(truncateText("ab🔥cd", 3)).toBe("ab…")
  })
})

describe("listingAtAGlance with emoji at the cut", () => {
  // The server serializes a lone surrogate as U+FFFD while the client keeps the raw unit: React hydration mismatch.
  it.each([218, 219, 220, 221])("is well-formed when an emoji straddles the 220 cut (emoji at %i)", (at) => {
    const description = `${"a".repeat(at)}🔥🔥🔥 ${"word ".repeat(40)}`
    const out = listingAtAGlance(description, "name", [])
    expect(out).toBeTruthy()
    expect(out).not.toMatch(LONE_SURROGATE)
  })
})

describe("CSP", () => {
  it("declares media-src so product videos on Vercel Blob are not reported on every page", () => {
    expect(AFFISELL_CSP_REPORT_ONLY).toMatch(/media-src [^;]*https:/)
  })
})
