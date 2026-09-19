import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/** The platform commission drives real payouts: no supplier-facing route may persist an override. */
describe("suppliers cannot lower Affisell's commission", () => {
  for (const file of ["app/api/supplier/products/route.ts", "app/api/supplier/products/[id]/route.ts"]) {
    it(`${file} never writes affisellCommissionRateOverrideBps`, () => {
      const src = readFileSync(file, "utf8")
      expect(src).not.toMatch(/affisellCommissionRateOverrideBps\s*:/)
      expect(src).not.toMatch(/parseAffisellCommissionOverrideFromBody/)
    })
  }
})
