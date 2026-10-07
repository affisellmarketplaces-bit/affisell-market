import { describe, expect, it } from "vitest"

import { euWithdrawalEndsAt, isWithinEuWithdrawalWindow } from "@/lib/buyer-withdrawal-window"
import { HIDDEN_SPEC_KEYS } from "@/lib/listing-compliance/spec-labels"
import { isWithinBuyerReturnWindow, buyerReturnWindowEndsAt } from "@/lib/order-return-policy"
import {
  effectiveReturnWindowDays,
  LEGAL_RETURN_WINDOW_DAYS,
  MAX_RETURN_WINDOW_DAYS,
  parseReturnWindowDays,
  RETURN_WINDOW_KEY,
  sanitizeReturnWindowRows,
} from "@/lib/return-terms"
import { mergeManagedProductAttributes, normalizeProductAttributesFromBody } from "@/lib/supplier-product-attributes"

const delivered = new Date("2026-03-01T10:00:00Z")
const order = { deliveredAt: delivered, deliveryConfirmedAt: null }
// Calendar days, like the policy itself ("30 days from delivery"): a fixed number of milliseconds drifts by an hour
// across a daylight-saving change, and would make these tests depend on the machine's time zone.
const daysAfter = (n: number) => {
  const d = new Date(delivered)
  d.setDate(d.getDate() + n)
  return d
}

describe("return window offered by the supplier", () => {
  it("only an EXTENSION of the legal 14 days is a value; everything else means 'nothing offered'", () => {
    expect(LEGAL_RETURN_WINDOW_DAYS).toBe(14)
    expect(parseReturnWindowDays(30)).toBe(30)
    expect(parseReturnWindowDays("60")).toBe(60)
    expect(parseReturnWindowDays(" 45 ")).toBe(45)
    expect(parseReturnWindowDays(MAX_RETURN_WINDOW_DAYS)).toBe(90)
    for (const bad of [14, 13, 0, -5, 91, 365, 30.5, "30.5", "abc", "", null, undefined, NaN, Infinity, {}, [], "1e2", "0x1E"]) {
      expect(parseReturnWindowDays(bad as never), String(bad)).toBeNull()
    }
  })

  it("the effective window is never below the legal 14 days", () => {
    expect(effectiveReturnWindowDays(null)).toBe(14)
    expect(effectiveReturnWindowDays(undefined)).toBe(14)
    expect(effectiveReturnWindowDays(7)).toBe(14)
    expect(effectiveReturnWindowDays(30)).toBe(30)
  })

  it("attribute rows: an invalid return window is dropped, a valid one is canonicalised, other rows are untouched", () => {
    const rows = [
      { key: "material", label: "Matériau", value: "Bois" },
      { key: RETURN_WINDOW_KEY, label: "x", value: " 45 " },
    ]
    expect(sanitizeReturnWindowRows(rows)).toEqual([rows[0], { key: RETURN_WINDOW_KEY, label: "x", value: "45" }])
    expect(sanitizeReturnWindowRows([{ key: RETURN_WINDOW_KEY, label: "x", value: "7" }])).toEqual([])
    expect(sanitizeReturnWindowRows([{ key: RETURN_WINDOW_KEY, label: "x", value: "99999" }])).toEqual([])
  })

  it("every route that accepts attribute rows goes through the same guard", () => {
    const out = normalizeProductAttributesFromBody([
      { key: RETURN_WINDOW_KEY, label: "Return window (days)", value: "10" },
      { key: "brand", label: "Brand", value: "Acme" },
    ])
    expect(out.map((r) => r.key)).toEqual(["brand"])
    expect(normalizeProductAttributesFromBody([{ key: RETURN_WINDOW_KEY, value: "30" }])[0]?.value).toBe("30")
  })

  it("is never shown as a spec row (it has its own line on the product page)", () => {
    expect(HIDDEN_SPEC_KEYS.has(RETURN_WINDOW_KEY)).toBe(true)
  })
})

describe("the window frozen on an order", () => {
  it("defaults to the legal 14 days from delivery — behaviour unchanged for every existing order", () => {
    expect(euWithdrawalEndsAt(order)?.getTime()).toBe(daysAfter(14).getTime())
    expect(isWithinBuyerReturnWindow(order, daysAfter(14))).toBe(true)
    expect(isWithinBuyerReturnWindow(order, daysAfter(20))).toBe(false)
  })

  it("a supplier-offered window extends it, counted from delivery", () => {
    expect(buyerReturnWindowEndsAt(order, 30)?.getTime()).toBe(daysAfter(30).getTime())
    expect(isWithinBuyerReturnWindow(order, daysAfter(20), 30)).toBe(true)
    expect(isWithinBuyerReturnWindow(order, daysAfter(30), 30)).toBe(true)
    expect(isWithinBuyerReturnWindow(order, daysAfter(31), 30)).toBe(false)
  })

  it("can never go below the legal window, whatever is passed", () => {
    expect(isWithinEuWithdrawalWindow(order, daysAfter(14), 3)).toBe(true)
    expect(euWithdrawalEndsAt(order, 0)?.getTime()).toBe(daysAfter(14).getTime())
  })

  it("nothing can be returned before there is a delivery to count from", () => {
    expect(isWithinBuyerReturnWindow({ deliveredAt: null, deliveryConfirmedAt: null }, delivered, 90)).toBe(false)
  })
})

describe("saving a product never silently changes the offered window", () => {
  const existing = [
    { key: "color", label: "Color", value: "red" },
    { key: RETURN_WINDOW_KEY, label: "Return window (days)", value: "30" },
  ]
  const keepReturn = new Set([RETURN_WINDOW_KEY])

  it("a form that does not own the key leaves it alone, even when the category changes", () => {
    const merged = mergeManagedProductAttributes(existing, [], ["gtin_x"], { categoryChanged: true, alwaysKeep: keepReturn })
    expect(merged.find((r) => r.key === RETURN_WINDOW_KEY)?.value).toBe("30")
  })

  it("a form that owns the key and sends none means 'legal window': the row goes", () => {
    const merged = mergeManagedProductAttributes(existing, [], [RETURN_WINDOW_KEY], { alwaysKeep: keepReturn })
    expect(merged.some((r) => r.key === RETURN_WINDOW_KEY)).toBe(false)
  })

  it("a form that owns the key and sends a new value replaces it", () => {
    const incoming = [{ key: RETURN_WINDOW_KEY, label: "Return window (days)", value: "60" }]
    const merged = mergeManagedProductAttributes(existing, incoming, [RETURN_WINDOW_KEY], { alwaysKeep: keepReturn })
    expect(merged.filter((r) => r.key === RETURN_WINDOW_KEY)).toEqual(incoming)
  })
})
