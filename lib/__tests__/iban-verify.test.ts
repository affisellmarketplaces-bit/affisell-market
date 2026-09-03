import { describe, expect, it } from "vitest"

import { verifyIbanMod97 } from "@/lib/payouts/iban-verify"

describe("verifyIbanMod97", () => {
  it("accepts a known-valid IBAN", () => {
    expect(verifyIbanMod97("FR76 3000 6000 0112 3456 7890 189")).toBe(true)
  })

  it("rejects invalid check digits", () => {
    expect(verifyIbanMod97("FR76 3000 6000 0112 3456 7890 180")).toBe(false)
  })

  it("rejects too-short values", () => {
    expect(verifyIbanMod97("FR761")).toBe(false)
  })
})
