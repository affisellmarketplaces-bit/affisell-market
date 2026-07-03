import { describe, expect, it } from "vitest"

import { resolvePublicNavSearchContext } from "@/lib/public-nav-search-context"

describe("resolvePublicNavSearchContext", () => {
  it("returns home on /", () => {
    expect(resolvePublicNavSearchContext("/", false)).toBe("home")
  })

  it("returns marketplace on explorer hash", () => {
    expect(resolvePublicNavSearchContext("/", true)).toBe("marketplace")
  })

  it("returns creatorStores on /shops slug", () => {
    expect(resolvePublicNavSearchContext("/shops/demo", false)).toBe("creatorStores")
  })
})
