import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import {
  isStockUnconfirmed,
  resolveImportedStock,
  sourceQuantity,
  stockFromSource,
  stockFromVariantQuantities,
  STOCK_UNCONFIRMED_KEY,
} from "@/lib/import-stock"
import { mapAliExpressGetProductResponse } from "@/lib/aliexpress-product-map"
import { mapScrapedProductForImportSave } from "@/lib/map-extension-import-product"
import { buildUrlImportFormPatch } from "@/lib/url-import-apply"
import { importPublicationStatus } from "@/lib/reseller-import/review"
import { decideImportPublication } from "@/lib/listing-compliance/import-publication.server"
import { buildHealthReport, diagnoseProduct, type HealthProduct } from "@/lib/supplier-catalog-health/diagnose"

const root = path.resolve(__dirname, "../..")
const read = (f: string) => readFileSync(path.join(root, f), "utf8")

describe("imported quantities — provenance, never a fallback (founder decision 2026-11-19)", () => {
  it("a source quantity is kept as is, 99 and 999 included: they are not presumed fictitious", () => {
    expect(stockFromSource(99)).toEqual({ stock: 99, stockProvenance: "source" })
    expect(stockFromSource("999")).toEqual({ stock: 999, stockProvenance: "source" })
    expect(stockFromSource(0)).toEqual({ stock: 0, stockProvenance: "source" })
  })

  it("absence is « not provided », never a number", () => {
    for (const raw of [undefined, null, "", "  ", "n/a", Number.NaN, -1]) {
      expect(sourceQuantity(raw)).toBeNull()
      expect(stockFromSource(raw)).toEqual({ stock: 0, stockProvenance: "not_provided" })
    }
  })

  it("variant totals count only when every variant carries a quantity", () => {
    expect(stockFromVariantQuantities([2, "3"])).toEqual({ stock: 5, stockProvenance: "source" })
    expect(stockFromVariantQuantities([2, undefined])).toEqual({ stock: 0, stockProvenance: "not_provided" })
    expect(stockFromVariantQuantities([])).toEqual({ stock: 0, stockProvenance: "not_provided" })
  })

  it("what is written: a source figure is confirmed; anything else is stock 0 to confirm (fail closed)", () => {
    expect(resolveImportedStock({ stock: 999, stockProvenance: "source" })).toEqual({ stock: 999, confirmed: true })
    expect(resolveImportedStock({ stock: 999, stockProvenance: "not_provided" })).toEqual({ stock: 0, confirmed: false })
    expect(resolveImportedStock({ stock: 999 })).toEqual({ stock: 0, confirmed: false })
    expect(isStockUnconfirmed([{ key: STOCK_UNCONFIRMED_KEY, value: "1" }])).toBe(true)
    expect(isStockUnconfirmed([{ key: "brand", value: "x" }])).toBe(false)
  })

  it("AliExpress API: a SKU quantity is a source figure; no quantity is no longer read as 1", () => {
    const envelope = (sku: Record<string, unknown>) => ({
      aliexpress_ds_product_get_response: {
        result: {
          ae_item_base_info_dto: { subject: "Lampe", product_id: "1005" },
          ae_multimedia_info_dto: { image_urls: "https://ae01.alicdn.com/a.jpg" },
          ae_item_sku_info_dtos: { ae_item_sku_info_d_t_o: [{ sku_id: "1", offer_sale_price: "5.00", sku_price: "5.00", ...sku }] },
          target_sale_price: "5.00",
        },
      },
    })
    const known = mapAliExpressGetProductResponse(envelope({ sku_available_stock: 20 }), "1005")
    expect([known.stock, known.stockProvenance]).toEqual([20, "source"])
    const unknown = mapAliExpressGetProductResponse(envelope({}), "1005")
    expect([unknown.stock, unknown.stockProvenance]).toEqual([0, "not_provided"])
  })

  it("extension import rows: a figure is kept only when its provenance says « source »", () => {
    expect(mapScrapedProductForImportSave({ title: "x", price: 1, stock: 5, stockProvenance: "source" }).stock).toBe(5)
    const row = mapScrapedProductForImportSave({ title: "x", price: 1, stock: 5 })
    expect([row.stock, row.stockProvenance]).toEqual([0, "not_provided"])
  })

  it("the supplier form is never prefilled with an unknown quantity", () => {
    const opts = { markup: 2.5, categoryAttrs: [], commissionPct: "15" }
    expect(buildUrlImportFormPatch({ title: "x", price: 10, stock: 999 }, opts).stock).toBe("")
    expect(buildUrlImportFormPatch({ title: "x", price: 10, stock: 12, stockProvenance: "source" }, opts).stock).toBe("12")
  })

  it("publication gates: an unconfirmed quantity keeps the import a draft, whatever the readiness mode", () => {
    expect(
      decideImportPublication({ source: "import_exec", supplierId: "s", wantLive: true, stockUnconfirmed: true, mode: "off" })
    ).toEqual({ live: false, downgradedToDraft: true })
    expect(decideImportPublication({ source: "import_exec", supplierId: "s", wantLive: true, mode: "off" }).live).toBe(true)
    expect(
      importPublicationStatus({ reviewState: "approved", compliance: { applicable: false, blocking: [] }, stockUnconfirmed: true })
    ).toMatchObject({ publishable: false, reason: "stock_unconfirmed" })
  })

  it("catalogue health: « quantity to confirm » is a blocage, not also « sold out » or « nominal »", () => {
    const p: HealthProduct = {
      id: "p",
      name: "Lampe",
      isDraft: true,
      active: false,
      listingKind: "PHYSICAL",
      basePriceCents: 1000,
      stock: 0,
      hasVariants: false,
      variantRowStocks: null,
      stockUnconfirmed: true,
      commissionExplicit: true,
      imageCount: 4,
      descriptionLength: 400,
      categoryId: "c",
      hasGtin: true,
      deliveryMin: 2,
      deliveryMax: 5,
      safetyBlocking: [],
      holds: [],
      paidOrders30d: 0,
      resellersListing: 0,
      createdAt: new Date("2026-10-01"),
    }
    const codes = diagnoseProduct(p, { now: new Date("2026-11-19"), readinessMode: "warn" }).map((i) => i.code)
    expect(codes).toContain("stock_unconfirmed")
    expect(codes).not.toContain("draft_ready")
    expect(codes).not.toContain("stock_nominal")
    expect(buildHealthReport([p], { now: new Date("2026-11-19"), readinessMode: "warn" }).blockedProducts).toBe(1)
  })

  it("no importer writes a fallback quantity any more", () => {
    const files = [
      "lib/import-url-scrape.ts",
      "lib/supplier-import-url-handler.ts",
      "lib/map-extension-import-product.ts",
      "lib/affiliate-url-import.server.ts",
      "lib/marketplace/import-from-url.server.ts",
      "lib/dropforge-complete-import.ts",
      "lib/aliexpress-product-map.ts",
      "lib/admin/auto-fulfill/enlist-ae-product.ts",
      "app/api/admin/products/route.ts",
    ]
    for (const f of files) {
      const src = read(f)
      expect(src, f).not.toMatch(/stock:\s*(50|99|999)\b|\|\|\s*(99|999)\b|:\s*999\s*$|stock > 0 \? stock : 1/m)
    }
  })

  it("every writer of an imported product carries the marker path", () => {
    for (const f of [
      "lib/affiliate-url-import.server.ts",
      "lib/marketplace/import-from-url.server.ts",
      "lib/supplier-dropforge-import.server.ts",
      "lib/supplier-products-import-exec.ts",
      "lib/admin/auto-fulfill/enlist-ae-product.ts",
      "app/api/admin/products/route.ts",
      "app/api/supplier/aliexpress/import/route.ts",
      "app/api/supplier/extension/aliexpress/route.ts",
    ]) {
      expect(read(f), f).toMatch(/import-stock/)
    }
    // the supplier saving a quantity is the confirmation; activation without it is refused
    expect(read("app/api/supplier/products/[id]/route.ts")).toContain("STOCK_UNCONFIRMED_ERROR")
    expect(read("app/api/products/[id]/route.ts")).toContain("STOCK_UNCONFIRMED_ERROR")
  })
})

describe("demo data stays apart from real commercial data", () => {
  it("demo-lab products are excluded from the shopper filter in production and from non-demo resellers' catalogue", () => {
    expect(read("lib/marketplace-buyer-product-filter.ts")).toMatch(/resolveRuntimeEnvironment\(\) === "production" \? \[\{ tags: \{ has: DEMO_LAB_TAG \} \}\]/)
    expect(read("lib/affiliate-catalog-query.ts")).toMatch(/viewerIsDemoAccount/)
  })
})
