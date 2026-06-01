import { describe, expect, it } from "vitest"

import {
  DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY,
  DEFAULT_SUPPLIER_FEE_BPS_CATALOG,
} from "@/lib/marketplace-phase1-fees"
import {
  buildPhase1FeesForOrderLine,
  orderUsesAffisellAutoBuy,
  resolveOrderUsesAffisellAutoBuy,
  resolveSupplierFeeBpsForOrder,
  wholesaleCentsForSupplierPlatformFee,
} from "@/lib/marketplace-supplier-fee"

describe("orderUsesAffisellAutoBuy", () => {
  it("requires active link and toggle", () => {
    expect(
      orderUsesAffisellAutoBuy({
        supplierLink: { isActive: true, autoBuyEnabled: true },
      })
    ).toBe(true)
    expect(
      orderUsesAffisellAutoBuy({
        supplierLink: { isActive: true, autoBuyEnabled: false },
        productAutoBuyEnabled: true,
      })
    ).toBe(true)
    expect(
      orderUsesAffisellAutoBuy({
        supplierLink: { isActive: false, autoBuyEnabled: true },
      })
    ).toBe(false)
    expect(
      orderUsesAffisellAutoBuy({
        supplierLink: null,
      })
    ).toBe(false)
  })
})

describe("resolveSupplierFeeBpsForOrder", () => {
  it("uses catalog vs auto-buy defaults", () => {
    expect(
      resolveSupplierFeeBpsForOrder({
        usesAffisellAutoBuy: false,
        supplier: {},
      })
    ).toBe(DEFAULT_SUPPLIER_FEE_BPS_CATALOG)
    expect(
      resolveSupplierFeeBpsForOrder({
        usesAffisellAutoBuy: true,
        supplier: {},
      })
    ).toBe(DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY)
  })

  it("respects per-mode overrides", () => {
    expect(
      resolveSupplierFeeBpsForOrder({
        usesAffisellAutoBuy: false,
        supplier: { supplierFeeBpsCatalog: 800 },
      })
    ).toBe(800)
    expect(
      resolveSupplierFeeBpsForOrder({
        usesAffisellAutoBuy: true,
        supplier: { supplierFeeBpsAutoBuy: 2000 },
      })
    ).toBe(2000)
  })

  it("legacy supplierFeeBps overrides both", () => {
    expect(
      resolveSupplierFeeBpsForOrder({
        usesAffisellAutoBuy: true,
        supplier: { supplierFeeBps: 1500, supplierFeeBpsAutoBuy: 2000 },
      })
    ).toBe(1500)
  })
})

describe("wholesaleCentsForSupplierPlatformFee", () => {
  it("uses catalog wholesale when not auto-buy even if AE price exists", () => {
    expect(
      wholesaleCentsForSupplierPlatformFee({
        usesAffisellAutoBuy: false,
        supplierPriceCents: 59_804,
        aeWholesaleCents: 45_000,
      })
    ).toBe(59_804)
  })

  it("uses AE wholesale only in auto-buy mode", () => {
    expect(
      wholesaleCentsForSupplierPlatformFee({
        usesAffisellAutoBuy: true,
        supplierPriceCents: 59_804,
        aeWholesaleCents: 45_000,
      })
    ).toBe(45_000)
  })
})

describe("resolveOrderUsesAffisellAutoBuy", () => {
  it("prefers checkout snapshot over live link", () => {
    expect(
      resolveOrderUsesAffisellAutoBuy({
        usesAffisellAutoBuy: false,
        supplierLink: { isActive: true, autoBuyEnabled: true },
      })
    ).toBe(false)
  })
})

describe("buildPhase1FeesForOrderLine", () => {
  it("applies 10% on catalog wholesale for catalogue channel", () => {
    const fees = buildPhase1FeesForOrderLine({
      usesAffisellAutoBuy: false,
      supplier: {},
      supplierPriceCents: 10_000,
      aeWholesaleCents: 8_000,
      affiliateCommissionCents: 1_000,
      affiliateMarginRetainedCents: 500,
    })
    expect(fees.supplierFeeBps).toBe(DEFAULT_SUPPLIER_FEE_BPS_CATALOG)
    expect(fees.wholesaleForFeesCents).toBe(10_000)
    expect(fees.supplierFeeCents).toBe(1_000)
  })
})
