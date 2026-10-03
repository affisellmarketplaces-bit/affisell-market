import { describe, expect, it } from "vitest"

import { replaceAffisellBrand } from "@/lib/brand-name-shared"

describe("replaceAffisellBrand", () => {
  it("swaps the whole word in every locale's cookie copy", () => {
    expect(replaceAffisellBrand("We use essential cookies to run Affisell, and audience cookies.", "Maison Léa")).toBe(
      "We use essential cookies to run Maison Léa, and audience cookies."
    )
    expect(replaceAffisellBrand("pour faire fonctionner Affisell, et des cookies", "Maison Léa")).toBe(
      "pour faire fonctionner Maison Léa, et des cookies"
    )
    expect(replaceAffisellBrand("以确保 Affisell 正常运行", "Maison Léa")).toBe("以确保 Maison Léa 正常运行")
  })

  it("leaves lookalikes and the platform case (no brand) untouched", () => {
    expect(replaceAffisellBrand("Affiselling affisellfoo", "X")).toBe("Affiselling affisellfoo")
    expect(replaceAffisellBrand("Run Affisell", undefined)).toBe("Run Affisell")
    expect(replaceAffisellBrand("Run Affisell", "  ")).toBe("Run Affisell")
  })

  it("inserts a store name literally ($ patterns are not interpreted)", () => {
    expect(replaceAffisellBrand("Hello Affisell", "Cash $& Co $1")).toBe("Hello Cash $& Co $1")
  })
})
