import { describe, expect, it } from "vitest"

import { isDemoLabRoute, isDemoPersonaKey } from "@/lib/demo/demo-routes"

describe("demo-routes", () => {
  it("detects demo lab paths", () => {
    expect(isDemoLabRoute("/demo")).toBe(true)
    expect(isDemoLabRoute("/demo/supplier")).toBe(true)
    expect(isDemoLabRoute("/fr/demo")).toBe(true)
    expect(isDemoLabRoute("/marketplace")).toBe(false)
  })

  it("validates persona keys", () => {
    expect(isDemoPersonaKey("supplier")).toBe(true)
    expect(isDemoPersonaKey("invalid")).toBe(false)
  })
})
