import { describe, expect, it } from "vitest"

import {
  validateSimpleColorName,
  validateSimpleColorRows,
} from "@/lib/supplier-simple-color-validation"

describe("supplier-simple-color-validation", () => {
  it("allows slash in color names like Noir/Rouge", () => {
    expect(validateSimpleColorName("Noir/Rouge")).toBeNull()
    expect(validateSimpleColorName("Noir/Noir")).toBeNull()
    expect(validateSimpleColorName("Noir/Rose")).toBeNull()
  })

  it("allows parens and dot for variant specs like X1(7.8Ah 25KM)", () => {
    expect(validateSimpleColorName("X1(7.8Ah 25KM)")).toBeNull()
    expect(validateSimpleColorName("ES80")).toBeNull()
  })

  it("rejects comma and plus", () => {
    expect(validateSimpleColorName("Noir,Rouge")).toMatch(/virgule/)
    expect(validateSimpleColorName("Noir+Rouge")).toMatch(/\+/)
  })

  it("detects duplicate colors", () => {
    const issues = validateSimpleColorRows([
      { name: "Noir" },
      { name: "noir" },
    ])
    expect(issues.some((i) => i.message.includes("déjà"))).toBe(true)
  })
})
