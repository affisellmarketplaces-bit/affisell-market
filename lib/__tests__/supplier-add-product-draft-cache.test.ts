import { describe, expect, it } from "vitest"

import {
  isExpressImportDraftCache,
  supplierExpressHandoffWizardUrl,
  type SupplierAddProductCachePayload,
} from "@/lib/supplier-add-product-draft-cache"

const basePayload = (): SupplierAddProductCachePayload => ({
  v: 2,
  ownerUserId: "user-1",
  updatedAt: Date.now(),
  mode: "compose",
  step: 1,
  name: "Pistolet à eau électrique",
  description: "Jouet outdoor",
  categoryId: "cat-1",
  images: ["https://ae01.alicdn.com/kf/hero.jpg"],
  price: "18.73",
  compareAt: "",
  stock: "99",
  listingKind: "PHYSICAL",
  commission: "14",
  shippingCountry: "FR",
  warehouseType: "regional",
  deliveryCountryCodes: ["WORLDWIDE"],
  processingTime: "1",
  deliveryMin: "2",
  deliveryMax: "7",
  shippingCost: "0",
  shipsFrom: "",
  deliveryDays: "",
  freeShipping: true,
  offerMode: "NEW",
  minOrderQuantity: 1,
  supplierTag: "express-import",
  specValues: { power: "7.4V" },
  descriptionBullets: [],
  descriptionIllustrationImages: ["https://ae01.alicdn.com/kf/detail.jpg"],
  descriptionIllustrationVideos: [],
  variantFormMode: "none",
  variantSizesText: "",
  variantColorsText: "",
  simpleColorRows: [],
  variantRows: [],
  advancedSkuRows: [],
  skuCustomColumns: [],
  skuHiddenColumns: [],
})

describe("supplier-add-product-draft-cache express handoff", () => {
  it("builds wizard Pro URL with expressHandoff flag", () => {
    expect(supplierExpressHandoffWizardUrl()).toContain("wizard=v1")
    expect(supplierExpressHandoffWizardUrl()).toContain("compose=1")
    expect(supplierExpressHandoffWizardUrl()).toContain("expressHandoff=1")
  })

  it("accepts fresh express-import cache", () => {
    expect(isExpressImportDraftCache(basePayload())).toBe(true)
  })

  it("rejects stale or non-express cache", () => {
    const stale = { ...basePayload(), updatedAt: Date.now() - 20 * 60 * 1000 }
    expect(isExpressImportDraftCache(stale)).toBe(false)
    expect(isExpressImportDraftCache({ ...basePayload(), supplierTag: "manual" })).toBe(false)
    expect(isExpressImportDraftCache({ ...basePayload(), name: "", images: [] })).toBe(false)
  })
})
