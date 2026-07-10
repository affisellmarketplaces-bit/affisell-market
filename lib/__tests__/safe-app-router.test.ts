import { describe, expect, it } from "vitest"

import { isRouterNotReadyError } from "@/lib/safe-app-router"

describe("safe-app-router", () => {
  it("detects router-not-ready errors", () => {
    expect(
      isRouterNotReadyError(new Error("Internal Next.js error: Router action dispatched before initialization."))
    ).toBe(true)
    expect(isRouterNotReadyError(new Error("network"))).toBe(false)
  })
})
