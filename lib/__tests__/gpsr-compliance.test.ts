import { describe, expect, it } from "vitest"

import { isCompliant, isGpsrCompliant } from "@/lib/legal/gpsr"

describe("isGpsrCompliant", () => {
  it("requires manufacturer name, address, valid email", () => {
    expect(
      isGpsrCompliant({
        manufacturerName: "",
        manufacturerAddress: "1 rue Test",
        manufacturerEmail: "a@b.com",
      }).compliant
    ).toBe(false)

    expect(
      isGpsrCompliant({
        manufacturerName: "ACME SAS",
        manufacturerAddress: "1 rue Test, 75001 Paris",
        manufacturerEmail: "contact@acme.fr",
      })
    ).toEqual({ compliant: true, missing: [] })
  })

  it("exports isCompliant alias", () => {
    expect(isCompliant).toBe(isGpsrCompliant)
  })
})
