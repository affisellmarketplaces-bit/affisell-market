import { describe, expect, it } from "vitest"

import { safeRandomId } from "@/lib/safe-random-id"

describe("safeRandomId", () => {
  it("returns a non-empty id with optional prefix", () => {
    const id = safeRandomId("x-")
    expect(id.startsWith("x-")).toBe(true)
    expect(id.length).toBeGreaterThan(4)
  })
})
