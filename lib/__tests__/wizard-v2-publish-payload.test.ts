import { describe, expect, it } from "vitest"

import {
  buildWizardV2PublishBody,
  WizardPublishDeclarationError,
} from "@/lib/product-wizard-v2/build-publish-payload"
import { DELIVERY_WORLDWIDE } from "@/lib/supplier-delivery-countries"

const defaults = {
  countryCode: "FR",
  warehouseType: "regional",
  offerMode: "NEW",
  defaultCommissionPct: 18,
}
const base = {
  name: "Test",
  description: "Desc",
  price: 29.9,
  stock: "7",
  categoryId: "cat_1",
  images: ["https://cdn.example/p.jpg"],
  commission: 15,
}

function codesOf(fn: () => unknown): string[] {
  try {
    fn()
  } catch (e) {
    if (e instanceof WizardPublishDeclarationError) return e.codes
    throw e
  }
  return []
}

describe("buildWizardV2PublishBody", () => {
  it("builds the publish payload from what the supplier declared", () => {
    const body = buildWizardV2PublishBody(base, defaults)
    expect(body.name).toBe("Test")
    expect(body.price).toBe(29.9)
    expect(body.stock).toBe(7)
    expect(body.commission).toBe(15)
    expect(body.images).toEqual(["https://cdn.example/p.jpg"])
    expect(body.deliveryCountryCodes).toEqual([DELIVERY_WORLDWIDE])
    expect(body.publish).toBe(true)
  })

  it("never invents a price (was 10 €) — founder decision 2026-11-19", () => {
    expect(codesOf(() => buildWizardV2PublishBody({ ...base, price: 0 }, defaults))).toContain("price_required")
    expect(codesOf(() => buildWizardV2PublishBody({ ...base, price: Number.NaN }, defaults))).toContain("price_required")
  })

  it("never invents a quantity (was 99)", () => {
    expect(codesOf(() => buildWizardV2PublishBody({ ...base, stock: "" }, defaults))).toEqual(["stock_required"])
    expect(codesOf(() => buildWizardV2PublishBody({ ...base, stock: undefined }, defaults))).toEqual(["stock_required"])
    expect(codesOf(() => buildWizardV2PublishBody({ ...base, stock: "2.5" }, defaults))).toEqual(["stock_required"])
    expect(codesOf(() => buildWizardV2PublishBody({ ...base, stock: "0" }, defaults))).toEqual(["stock_zero"])
  })

  it("with SKU rows, the total is the rows' declared quantities, never a fallback", () => {
    const row = (stock: number) => ({ color: "Noir", size: "M", sku: "", stock, supplierPrice: 10 }) as never
    const body = buildWizardV2PublishBody({ ...base, stock: "", skuVariants: { hasVariants: true, variants: [row(2), row(3)] } }, defaults)
    expect(body.stock).toBe(5)
    expect(body.hasVariants).toBe(true)
    expect(
      codesOf(() => buildWizardV2PublishBody({ ...base, skuVariants: { hasVariants: true, variants: [row(0), row(0)] } }, defaults))
    ).toEqual(["stock_zero"])
  })
})
