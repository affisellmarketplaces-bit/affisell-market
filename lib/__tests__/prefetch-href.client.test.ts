import { describe, expect, it } from "vitest"

import { normalizePrefetchHref } from "@/lib/prefetch-href.client"

describe("normalizePrefetchHref", () => {
  it("strips hash and query from internal paths", () => {
    expect(normalizePrefetchHref("/#explorer")).toBe("/")
    expect(normalizePrefetchHref("/cart?checkout=1")).toBe("/cart")
    expect(normalizePrefetchHref("/shops/demo")).toBe("/shops/demo")
  })

  it("rejects external and dynamic segments", () => {
    expect(normalizePrefetchHref("https://affisell.com")).toBeNull()
    expect(normalizePrefetchHref("/marketplace/[id]")).toBeNull()
  })
})
