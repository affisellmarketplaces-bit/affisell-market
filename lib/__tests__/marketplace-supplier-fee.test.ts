import { describe, expect, it } from "vitest"

import {
  DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY,
  DEFAULT_SUPPLIER_FEE_BPS_CATALOG,
} from "@/lib/marketplace-phase1-fees"
import {
  orderUsesAffisellAutoBuy,
  resolveSupplierFeeBpsForOrder,
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
