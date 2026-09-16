import { describe, expect, it } from "vitest"

import { resolvePublicNavSearchContext } from "@/lib/public-nav-search-context"

describe("resolvePublicNavSearchContext", () => {
  it("returns home on /", () => {
    expect(resolvePublicNavSearchContext("/", false)).toBe("home")
  })

  it("stays home on explorer hash (premium home owns chrome)", () => {
    expect(resolvePublicNavSearchContext("/", true)).toBe("home")
  })

  it("returns creatorStores on /shops slug", () => {
    expect(resolvePublicNavSearchContext("/shops/demo", false)).toBe("creatorStores")
  })
})
