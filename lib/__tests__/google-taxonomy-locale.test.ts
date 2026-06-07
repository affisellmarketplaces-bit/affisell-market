import { describe, expect, it } from "vitest"

import { localizeCategoryName } from "@/lib/google-taxonomy-locale"

describe("localizeCategoryName", () => {
  it("localizes by googleId for every supported locale", () => {
    const row = { googleId: 1, name: "Animaux et articles pour animaux de compagnie" }
    expect(localizeCategoryName(row, "en")).toBe("Animals & Pet Supplies")
    expect(localizeCategoryName(row, "de")).toBe("Tiere & Tierbedarf")
    expect(localizeCategoryName(row, "zh")).toContain("动物")
  })

  it("falls back to DB name when googleId is missing", () => {
    expect(localizeCategoryName({ googleId: null, name: "Custom aisle" }, "de")).toBe("Custom aisle")
  })
})
