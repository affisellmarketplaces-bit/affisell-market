import { Prisma } from "@prisma/client"
import { describe, expect, it } from "vitest"

import {
  decimalToNumber,
  isPrismaDecimal,
  serializeForClient,
  serializeProductDecimalFields,
} from "@/lib/serialize-for-client"

describe("serialize-for-client", () => {
  it("detects Prisma Decimal", () => {
    expect(isPrismaDecimal(new Prisma.Decimal("19.99"))).toBe(true)
    expect(isPrismaDecimal(19.99)).toBe(false)
  })

  it("converts decimal fields on product rows", () => {
    const row = {
      id: "p1",
      compareAt: new Prisma.Decimal("29.99"),
      freeShippingThreshold: new Prisma.Decimal("50"),
      shippingCost: new Prisma.Decimal("4.5"),
      name: "Widget",
    }
    const out = serializeProductDecimalFields(row)
    expect(out.compareAt).toBe(29.99)
    expect(out.freeShippingThreshold).toBe(50)
    expect(out.shippingCost).toBe(4.5)
  })

  it("deep-serializes nested decimals and dates", () => {
    const input = {
      compareAt: new Prisma.Decimal("10"),
      nested: { at: new Date("2026-01-15T12:00:00.000Z") },
    }
    const out = serializeForClient(input)
    expect(out.compareAt).toBe(10)
    expect(out.nested.at).toBe("2026-01-15T12:00:00.000Z")
  })

  it("decimalToNumber handles null and numbers", () => {
    expect(decimalToNumber(null)).toBeNull()
    expect(decimalToNumber(12)).toBe(12)
    expect(decimalToNumber(new Prisma.Decimal("3.14"))).toBeCloseTo(3.14)
  })
})
