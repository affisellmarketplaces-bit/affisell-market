import { describe, expect, it } from "vitest"

import { globalErrorCopy } from "@/lib/global-error-copy"

describe("global-error-copy", () => {
  it("returns lightweight EN/FR copy without message bundles", () => {
    expect(globalErrorCopy("en").title).toContain("load")
    expect(globalErrorCopy("fr").title).toContain("charger")
    expect(globalErrorCopy("de").signOut).toBe("Sign out")
  })
})
