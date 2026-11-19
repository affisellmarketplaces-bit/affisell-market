import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  AVAILABILITY_MODES,
  availabilityModeFor,
  listingKindNeedsStock,
  parseDeclaredPriceEur,
  parseDeclaredQuantity,
  validatePublishDeclaration,
} from "@/lib/product-availability"

describe("declared availability (founder decision 2026-11-19)", () => {
  it("only supported modes are offered; the others are listed as unsupported", () => {
    const supported = AVAILABILITY_MODES.filter((m) => m.supported).map((m) => m.id)
    expect(supported).toEqual(["quantity", "not_stocked"])
    expect(AVAILABILITY_MODES.find((m) => m.id === "preorder")?.supported).toBe(false)
  })

  it("non-physical listing kinds need no stock", () => {
    for (const k of ["SERVICE", "software", "SUBSCRIPTION", "EXPERIENCE"]) expect(listingKindNeedsStock(k)).toBe(false)
    expect(listingKindNeedsStock("PHYSICAL")).toBe(true)
    expect(listingKindNeedsStock(null)).toBe(true)
    expect(availabilityModeFor("SERVICE")).toBe("not_stocked")
    const ok = validatePublishDeclaration({ listingKind: "SERVICE", price: "40", stock: "" })
    expect(ok).toEqual({ ok: true, priceEur: 40, stock: null, mode: "not_stocked" })
  })

  it("a quantity is a whole number the supplier typed", () => {
    expect(parseDeclaredQuantity("12")).toBe(12)
    expect(parseDeclaredQuantity(" 0 ")).toBe(0)
    for (const bad of ["", "  ", "-1", "1.5", "abc", "1e3", null, undefined, 2.5, -3, Number.NaN, 2_000_000]) {
      expect(parseDeclaredQuantity(bad)).toBeNull()
    }
  })

  it("a price is > 0, rounded to the cent, comma accepted", () => {
    expect(parseDeclaredPriceEur("19,9")).toBe(19.9)
    expect(parseDeclaredPriceEur(10.005)).toBe(10.01)
    for (const bad of [0, "", "0", -2, "x", null, Number.POSITIVE_INFINITY]) expect(parseDeclaredPriceEur(bad)).toBeNull()
  })

  it("reports every missing declaration at once", () => {
    expect(validatePublishDeclaration({ price: "", stock: "" })).toEqual({ ok: false, errors: ["price_required", "stock_required"] })
    expect(validatePublishDeclaration({ price: 5, stock: "", variantStocks: [3, ""] })).toEqual({ ok: false, errors: ["variant_stock_required"] })
  })

  it("the guided wizard no longer contains an invented price or quantity", () => {
    const src = readFileSync(path.resolve(__dirname, "../product-wizard-v2/build-publish-payload.ts"), "utf8")
    expect(src).not.toMatch(/stock:\s*99|\|\|\s*99|:\s*10\s*$/m)
    const hub = readFileSync(path.resolve(__dirname, "../../components/products/wizard/WizardHub.tsx"), "utf8")
    expect(hub).not.toMatch(/:\s*99\s*$/m)
  })
})
