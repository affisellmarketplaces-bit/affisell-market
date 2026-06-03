import { describe, expect, it } from "vitest"

import { isPrismaMissingColumnError } from "@/lib/prisma-missing-column"

describe("isPrismaMissingColumnError", () => {
  it("matches P2022 by message when instanceof fails", () => {
    const err = {
      code: "P2022",
      message: "The column `User.supplierTrustTier` does not exist",
      meta: { column: "User.supplierTrustTier" },
    }
    expect(isPrismaMissingColumnError(err, "supplierTrustTier")).toBe(true)
  })

  it("rejects unrelated errors", () => {
    expect(isPrismaMissingColumnError(new Error("timeout"), "supplierTrustTier")).toBe(false)
  })
})
