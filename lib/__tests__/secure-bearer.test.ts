import { describe, expect, it } from "vitest"

import { secureBearerMatch } from "@/lib/secure-bearer"

describe("secureBearerMatch", () => {
  it("accepts exact Bearer token", () => {
    expect(secureBearerMatch("Bearer secret-token", "secret-token")).toBe(true)
  })

  it("rejects wrong or missing token", () => {
    expect(secureBearerMatch("Bearer wrong", "secret-token")).toBe(false)
    expect(secureBearerMatch(null, "secret-token")).toBe(false)
    expect(secureBearerMatch("secret-token", "secret-token")).toBe(false)
  })
})
